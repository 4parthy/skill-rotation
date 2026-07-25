'use strict';

module.exports = function RotationEngine(mod, stateTracker) {
    this.currentRotation = [];
    this.lastUsedSkills = [];

    this.update = (config) => {
        const newRotation = [];
        for (let i = 0; i < 4; i++) {
            for (const skill of config) {
                if (newRotation.some(s => s.id === skill.id)) continue;
                if (stateTracker.isSkillReady(skill)) {
                    newRotation.push(skill);
                    break;
                }
            }
        }
        this.currentRotation = newRotation;
    };

    this.skillUsed = (group, config) => {
        const usedSkill = config.find(s => Math.floor(s.id / 10000) === group);
        if (usedSkill) {
            if (this.lastUsedSkills[0] !== usedSkill) {
                this.lastUsedSkills.unshift(usedSkill);
                if (this.lastUsedSkills.length > 3) this.lastUsedSkills.pop();
                return true;
            }
        }
        return false;
    };

    mod.hook('C_START_SKILL', 7, (event) => {
        const skillId = event.skill.id;
        const group = Math.floor(skillId / 10000);
        
        mod.emit('skill-used', group);
    });
};
