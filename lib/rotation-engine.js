'use strict';

module.exports = function RotationEngine(mod, stateTracker, events) {
    this.currentRotation = [];
    this.lastUsedSkills = [];

    this.update = (config) => {
        if (!Array.isArray(config)) return;
        const newRotation = [];
        const simulatedCooldowns = new Map();
        
        // Project the next 4 skills
        for (let i = 0; i < 4; i++) {
            let found = false;
            for (const skill of config) {
                const group = Math.floor(skill.id / 10000);
                
                // Check real readiness
                if (!stateTracker.isSkillReady(skill)) continue;

                // Check simulated readiness for projection
                // A skill is "simulated ready" for slot i if its last simulated use was before slot i
                const lastUsedAtSlot = simulatedCooldowns.has(group) ? simulatedCooldowns.get(group) : -1;
                if (lastUsedAtSlot !== -1 && i <= lastUsedAtSlot) continue;

                newRotation.push(skill);
                simulatedCooldowns.set(group, i); // Mark this skill as used in slot i
                found = true;
                break;
            }
            if (!found) break; // Stop if no more skills are ready
        }
        this.currentRotation = newRotation;
    };

    this.skillUsed = (group, config) => {
        if (!Array.isArray(config)) return false;
        
        // Try to find the skill in the config to verify it's a tracked skill
        const trackedSkill = config.find(s => Math.floor(s.id / 10000) === group);
        if (!trackedSkill) return false;

        // Update history
        this.lastUsedSkills.unshift(trackedSkill);
        if (this.lastUsedSkills.length > 3) this.lastUsedSkills.pop();

        // Check if it matches the "Next" skill
        if (this.currentRotation[0] && Math.floor(this.currentRotation[0].id / 10000) === group) {
            this.currentRotation.shift();
            // We return true so that index.js calls update(true)
            return true;
        }

        // Return true anyway if it's a tracked skill, to refresh the UI with new history/cooldowns
        return true;
    };

    mod.hook('C_START_SKILL', '*', (event) => {
        const group = Math.floor(event.skill.id / 10000);
        events.emit('skill-used', group);
    });
};
