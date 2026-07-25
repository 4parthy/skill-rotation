'use strict';

module.exports = function StateTracker(mod) {
    const { me } = mod.require['tera-game-state'];
    
    this.cooldowns = new Map();
    this.abnormalities = new Map(); // target -> Map(id -> info)
    this.inCombat = false;

    // Cooldown tracking
    mod.hook('S_START_COOLTIME_SKILL', '*', (event) => {
        this.cooldowns.set(Math.floor(event.skill.id / 10000), Date.now() + event.cooldown);
        mod.emit('state-changed');
    });

    mod.hook('S_DECREASE_COOLTIME_SKILL', '*', (event) => {
        this.cooldowns.set(Math.floor(event.skill.id / 10000), Date.now() + event.cooldown);
        mod.emit('state-changed');
    });

    mod.hook('S_CREST_MESSAGE', '*', (event) => {
        if (event.type === 6) { // Skill reset
            this.cooldowns.set(Math.floor(event.skill / 10000), Date.now());
            mod.emit('state-changed');
        }
    });

    // Abnormality tracking
    mod.hook('S_ABNORMALITY_BEGIN', '*', (event) => {
        const target = event.target.toString();
        if (!this.abnormalities.has(target)) this.abnormalities.set(target, new Map());
        this.abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        mod.emit('state-changed');
    });

    mod.hook('S_ABNORMALITY_REFRESH', '*', (event) => {
        const target = event.target.toString();
        if (!this.abnormalities.has(target)) this.abnormalities.set(target, new Map());
        this.abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        mod.emit('state-changed');
    });

    mod.hook('S_ABNORMALITY_END', '*', (event) => {
        const target = event.target.toString();
        if (this.abnormalities.has(target)) {
            this.abnormalities.get(target).delete(event.id);
            mod.emit('state-changed');
        }
    });

    mod.game.on('combat_status', (active) => {
        this.inCombat = active;
        mod.emit('combat-status-changed', active);
        mod.emit('state-changed');
    });

    mod.hook('S_BOSS_GAGE_INFO', '*', (event) => {
        this.bossId = event.id.toString();
    });

    this.isSkillReady = (skill) => {
        const group = Math.floor(skill.id / 10000);
        const expires = this.cooldowns.get(group) || 0;
        if (expires > Date.now()) return false;

        if (skill.buffs) {
            for (const [target, conditions] of Object.entries(skill.buffs)) {
                let targetId;
                if (target === 'Self') {
                    if (me.gameId) targetId = me.gameId.toString();
                    else continue;
                }
                if (target === 'MyBoss') targetId = this.bossId;
                
                if (!targetId) continue;
                
                const targetAbnormalities = this.abnormalities.get(targetId) || new Map();
                if (conditions.missing) {
                    for (const id of conditions.missing) {
                        const ab = targetAbnormalities.get(id);
                        if (ab && ab.expires > Date.now()) return false;
                    }
                }
                if (conditions.active) {
                    for (const id of conditions.active) {
                        const ab = targetAbnormalities.get(id);
                        if (!ab || ab.expires <= Date.now()) return false;
                    }
                }
            }
        }

        if (skill.logic && typeof skill.logic === 'function') {
            if (!skill.logic({})) return false;
        }

        return true;
    };
};
