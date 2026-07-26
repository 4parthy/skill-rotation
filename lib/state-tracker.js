'use strict';

module.exports = function StateTracker(mod, events) {
    const { me } = mod.require['tera-game-state'];
    
    this.cooldowns = new Map();
    this.abnormalities = new Map(); // target -> Map(id -> info)
    this.inCombat = false;
    this.bossId = null;

    // Cooldown tracking
    mod.hook('S_START_COOLTIME_SKILL', '*', (event) => {
        const group = Math.floor(event.skill.id / 10000);
        this.cooldowns.set(group, Date.now() + event.cooldown);
        mod.log(`Cooldown started: Group ${group} for ${event.cooldown}ms`);
        events.emit('state-changed');
    });

    mod.hook('S_DECREASE_COOLTIME_SKILL', '*', (event) => {
        const group = Math.floor(event.skill.id / 10000);
        this.cooldowns.set(group, Date.now() + event.cooldown);
        events.emit('state-changed');
    });

    mod.hook('S_CREST_MESSAGE', '*', (event) => {
        if (event.type === 6) { // Skill reset
            const group = Math.floor(event.skill / 10000);
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

    mod.hook('C_START_SKILL', '*', (event) => {
        const group = Math.floor(event.skill.id / 10000);
        // Mock a cooldown to provide immediate feedback in the UI
        // This will be overwritten by S_START_COOLTIME_SKILL shortly
        this.cooldowns.set(group, Date.now() + 1000); 
        events.emit('state-changed');
    });

    this.isSkillReady = (skill) => {
        const group = Math.floor(skill.id / 10000);
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
