'use strict';

module.exports = function StateTracker(mod, events) {
    const { me } = mod.require['tera-game-state'];
    
    this.cooldowns = new Map();
    this.abnormalities = new Map(); // target -> Map(id -> info)
    this.inCombat = false;
    this.bossId = null;

    const getSkillId = (skill) => {
        if (skill == null) return null;
        if (typeof skill === 'number') return skill;
        if (typeof skill === 'bigint') return Number(skill);
        if (typeof skill.id === 'number') return skill.id;
        if (typeof skill.id === 'bigint') return Number(skill.id);
        return null;
    };

    const getGroup = (skill) => {
        const id = getSkillId(skill);
        return id == null ? null : Math.floor(id / 10000);
    };

    const describeSkill = (skill) => {
        if (skill == null) return 'null';
        if (typeof skill === 'number' || typeof skill === 'bigint') return `id=${skill}, group=${getGroup(skill)}`;

        const details = [];
        for (const key of ['id', 'type', 'npc', 'huntingZoneId', 'reserved']) {
            if (skill[key] !== undefined) details.push(`${key}=${skill[key]}`);
        }
        details.push(`group=${getGroup(skill)}`);
        return details.join(', ');
    };

    const sameGameId = (left, right) => left != null && right != null && left.toString() === right.toString();

    const emitSkillUsed = (skill, source) => {
        const group = getGroup(skill);
        events.emit('skill-used', group, skill, source);
    };

    // Cooldown tracking
    mod.hook('S_START_COOLTIME_SKILL', '*', (event) => {
        const group = getGroup(event.skill);
        if (group == null) return;
        const cooldown = Number(event.cooldown);
        this.cooldowns.set(group, Date.now() + cooldown);
        mod.log(`Cooldown started: ${describeSkill(event.skill)} for ${cooldown}ms`);
        if (cooldown > 0) emitSkillUsed(event.skill, 'cooldown-start');
        events.emit('state-changed');
    });

    mod.hook('S_DECREASE_COOLTIME_SKILL', '*', (event) => {
        const group = getGroup(event.skill);
        if (group == null) return;
        this.cooldowns.set(group, Date.now() + Number(event.cooldown));
        events.emit('state-changed');
    });

    mod.hook('S_CREST_MESSAGE', '*', (event) => {
        if (event.type === 6) { // Skill reset
            const group = getGroup(event.skill);
            if (group == null) return;
            this.cooldowns.set(group, Date.now());
            mod.log(`Skill reset: Group ${group}`);
            events.emit('state-changed');
        }
    });

    // Abnormality tracking
    mod.hook('S_ABNORMALITY_BEGIN', '*', (event) => {
        const target = event.target.toString();
        if (!this.abnormalities.has(target)) this.abnormalities.set(target, new Map());
        this.abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        events.emit('state-changed');
    });

    mod.hook('S_ABNORMALITY_REFRESH', '*', (event) => {
        const target = event.target.toString();
        if (!this.abnormalities.has(target)) this.abnormalities.set(target, new Map());
        this.abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        events.emit('state-changed');
    });

    mod.hook('S_ABNORMALITY_END', '*', (event) => {
        const target = event.target.toString();
        if (this.abnormalities.has(target)) {
            this.abnormalities.get(target).delete(event.id);
            events.emit('state-changed');
        }
    });

    mod.game.on('combat_status', (active) => {
        this.inCombat = active;
        mod.log(`Combat status changed: ${active}`);
        events.emit('state-changed');
    });

    mod.hook('S_BOSS_GAGE_INFO', '*', (event) => {
        this.bossId = event.id.toString();
    });

    mod.hook('S_ACTION_STAGE', '*', (event) => {
        if (!sameGameId(event.gameId, me.gameId)) return;
        if (event.stage !== undefined && Number(event.stage) !== 0) return;
        mod.log(`Player action stage: ${describeSkill(event.skill)}`);
        emitSkillUsed(event.skill, 'action-stage');
    });

    mod.hook('C_START_SKILL', '*', (event) => {
        const group = getGroup(event.skill);
        if (group == null) return;
        // Mock a cooldown to provide immediate feedback in the UI
        // This will be overwritten by S_START_COOLTIME_SKILL shortly
        this.cooldowns.set(group, Date.now() + 1000); 
        events.emit('state-changed');
    });

    this.isSkillReady = (skill) => {
        const group = getGroup(skill);
        const expires = this.cooldowns.get(group) || 0;
        const now = Date.now();
        if (expires > now) return false;

        if (skill.buffs) {
            for (const [target, conditions] of Object.entries(skill.buffs)) {
                let targetId;
                if (target === 'Self') {
                    if (me.gameId) targetId = me.gameId.toString();
                    else return (conditions.active && conditions.active.length > 0) ? false : true;
                } else if (target === 'MyBoss') {
                    targetId = this.bossId;
                }
                
                if (!targetId) {
                    if (conditions.active && conditions.active.length > 0) return false;
                    continue;
                }
                
                const targetAbnormalities = this.abnormalities.get(targetId) || new Map();
                if (conditions.missing) {
                    for (const id of conditions.missing) {
                        const ab = targetAbnormalities.get(id);
                        if (ab && ab.expires > now) return false;
                    }
                }
                if (conditions.active) {
                    for (const id of conditions.active) {
                        const ab = targetAbnormalities.get(id);
                        if (!ab || ab.expires <= now) return false;
                    }
                }
            }
        }

        return true;
    };
};
