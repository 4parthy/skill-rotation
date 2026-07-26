'use strict';

module.exports = function RotationEngine(mod, stateTracker, events) {
    this.currentRotation = [];
    this.lastUsedSkills = [];
    this.nextIndex = 0;
    this.config = null;

    const log = (message) => {
        if (typeof mod.log === 'function') mod.log(message);
    };

    const getSkillId = (skill) => {
        if (skill == null) return null;
        if (typeof skill === 'number') return skill;
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
        if (typeof skill === 'number') return `id=${skill}, group=${getGroup(skill)}`;

        const details = [];
        for (const key of ['id', 'type', 'npc', 'huntingZoneId', 'reserved']) {
            if (skill[key] !== undefined) details.push(`${key}=${skill[key]}`);
        }
        details.push(`group=${getGroup(skill)}`);
        return details.join(', ');
    };

    const findSkillIndex = (config, group) => config.findIndex(skill => getGroup(skill) === group);

    this.describeSkill = describeSkill;

    this.update = (config) => {
        if (!Array.isArray(config)) return;
        if (this.config !== config) {
            this.config = config;
            this.nextIndex = 0;
        }
        if (config.length === 0) {
            this.currentRotation = [];
            this.nextIndex = 0;
            return;
        }
        if (this.nextIndex >= config.length) this.nextIndex = 0;

        let startIndex = -1;
        for (let offset = 0; offset < config.length; offset++) {
            const index = (this.nextIndex + offset) % config.length;
            if (stateTracker.isSkillReady(config[index])) {
                startIndex = index;
                break;
            }
        }

        if (startIndex === -1) {
            this.currentRotation = [];
            return;
        }

        const newRotation = [];
        const displayCount = Math.min(4, config.length);

        for (let offset = 0; offset < displayCount; offset++) {
            const skill = config[(startIndex + offset) % config.length];
            newRotation.push(skill);
        }

        this.currentRotation = newRotation;
    };

    this.skillUsed = (group, config) => {
        if (!Array.isArray(config)) return false;
        
        // Try to find the skill in the config to verify it's a tracked skill
        const trackedIndex = findSkillIndex(config, group);
        if (trackedIndex === -1) {
            log(`Used skill group ${group} is not tracked by the active rotation config. Config groups: ${config.map(skill => `${skill.name}=${getGroup(skill)}(${getSkillId(skill)})`).join(', ')}`);
            return false;
        }
        const trackedSkill = config[trackedIndex];

        log(`Matched used skill group ${group} to rotation skill ${trackedSkill.name} (${describeSkill(trackedSkill)})`);

        // Update history
        this.lastUsedSkills.unshift(trackedSkill);
        if (this.lastUsedSkills.length > 3) this.lastUsedSkills.pop();

        const expectedGroup = this.currentRotation.length > 0
            ? getGroup(this.currentRotation[0])
            : null;

        if (group === expectedGroup) {
            this.nextIndex = (trackedIndex + 1) % config.length;
        } else {
            log(`Kept rotation position: expected group ${expectedGroup}, observed tracked group ${group}`);
        }

        // Return true for tracked skills so the history is refreshed even when used out of order.
        return true;
    };

    mod.hook('C_START_SKILL', '*', {
        order: -10000,
        filter: { fake: null, modified: null, silenced: null }
    }, (event) => {
        const group = getGroup(event.skill);
        log(`C_START_SKILL used skill: ${describeSkill(event.skill)}`);
        events.emit('skill-used', group, event.skill, 'client-start');
    });
};
