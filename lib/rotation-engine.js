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

    mod.hook('C_START_SKILL', 7, (event) => {
        const skillId = event.skill.id;
        const group = Math.floor(skillId / 10000);
        
        // This logic needs access to config, we might need to pass it or handle it in index.js
        // For now, let's keep the hook here but it needs the current config.
    });
};
