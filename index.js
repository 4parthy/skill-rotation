'use strict';

const path = require('path');

module.exports = function SkillRotation(mod) {
    const { me } = mod.require['tera-game-state'];

    let config = [];
    let cooldowns = new Map();
    let abnormalities = new Map(); // target -> Map(id -> info)
    let lastUsedSkills = [];
    let currentRotation = [];

    // Load config based on class
    function loadConfig() {
        try {
            const class_name = me.class;
            if (class_name) {
                // Clear cache to allow reloading during development
                delete require.cache[require.resolve(path.join(__dirname, 'config', `${class_name}.js`))];
                config = require(path.join(__dirname, 'config', `${class_name}.js`));
                mod.log(`Loaded rotation for ${class_name}`);
                updateRotation();
            }
        } catch (e) {
            mod.warn(`No rotation config found for class ${me.class}`);
            config = [];
        }
    }

    mod.game.on('enter_game', loadConfig);
    
    // Also try to load if already in game
    if (mod.game.me.inGame) loadConfig();

    // Cooldown tracking
    mod.hook('S_START_COOLTIME_SKILL', 3, (event) => {
        cooldowns.set(Math.floor(event.skill.id / 10000), Date.now() + event.cooldown);
        updateRotation();
    });

    mod.hook('S_DECREASE_COOLTIME_SKILL', 3, (event) => {
        cooldowns.set(Math.floor(event.skill.id / 10000), Date.now() + event.cooldown);
        updateRotation();
    });

    mod.hook('S_CREST_MESSAGE', 2, (event) => {
        if (event.type === 6) { // Skill reset
            cooldowns.set(Math.floor(event.skill / 10000), Date.now());
            updateRotation();
        }
    });

    // Abnormality tracking
    mod.hook('S_ABNORMALITY_BEGIN', 5, (event) => {
        const target = event.target.toString();
        if (!abnormalities.has(target)) abnormalities.set(target, new Map());
        abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        updateRotation();
    });

    mod.hook('S_ABNORMALITY_REFRESH', 2, (event) => {
        const target = event.target.toString();
        if (!abnormalities.has(target)) abnormalities.set(target, new Map());
        abnormalities.get(target).set(event.id, { expires: Date.now() + Number(event.duration), stacks: event.stacks });
        updateRotation();
    });

    mod.hook('S_ABNORMALITY_END', 1, (event) => {
        const target = event.target.toString();
        if (abnormalities.has(target)) {
            abnormalities.get(target).delete(event.id);
            updateRotation();
        }
    });

    // Detect skill usage
    mod.hook('C_START_SKILL', 7, (event) => {
        const skillId = event.skill.id;
        const group = Math.floor(skillId / 10000);
        
        // Find if this skill is in our config (any group match)
        const usedSkill = config.find(s => Math.floor(s.id / 10000) === group);
        if (usedSkill) {
            // Prevent duplicate entries for the same skill if used rapidly (e.g. multi-hits)
            if (lastUsedSkills[0] !== usedSkill) {
                lastUsedSkills.unshift(usedSkill);
                if (lastUsedSkills.length > 3) lastUsedSkills.pop();
                updateRotation();
            }
        }
    });

    function isSkillReady(skill) {
        const group = Math.floor(skill.id / 10000);
        const expires = cooldowns.get(group) || 0;
        if (expires > Date.now()) return false;

        if (skill.buffs) {
            for (const [target, conditions] of Object.entries(skill.buffs)) {
                let targetId;
                if (target === 'Self') targetId = me.gameId.toString();
                // Add more targets like MyBoss if needed
                
                const targetAbnormalities = abnormalities.get(targetId) || new Map();
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
            const state = {
                // Add relevant state info
            };
            if (!skill.logic(state)) return false;
        }

        return true;
    }

    function updateRotation() {
        const newRotation = [];
        // Simulate next skills
        const now = Date.now();
        
        for (let i = 0; i < 4; i++) {
            for (const skill of config) {
                // If we already added this skill in this simulated rotation, skip it to suggest variety
                // (Unless it's a very fast cooldown skill, but for simplicity we skip)
                if (newRotation.some(s => s.id === skill.id)) continue;

                if (isSkillReady(skill)) {
                    newRotation.push(skill);
                    break;
                }
            }
        }
        currentRotation = newRotation;
        displayRotation();
    }

    // State tracking
    let inCombat = false;
    mod.game.on('combat_status', (active) => {
        inCombat = active;
        if (!inCombat) {
            // Clear UI immediately
            mod.send('S_DUNGEON_EVENT_MESSAGE', 2, {
                type: 33,
                chat: false,
                channel: 0,
                message: ''
            });
        }
        updateRotation();
    });

    function displayRotation() {
        if (!inCombat) return;
        if (currentRotation.length === 0) {
             // Clear UI if no rotation
             mod.send('S_DUNGEON_EVENT_MESSAGE', 2, {
                type: 33,
                chat: false,
                channel: 0,
                message: ''
            });
            return;
        }

        const nextSkill = currentRotation[0];
        let msg = `<font color="#00FF00" size="24">Next: ${nextSkill.name}</font>`;
        
        if (currentRotation.length > 1) {
            msg += `<br/><font color="#FFFFFF" size="18">Future: ${currentRotation.slice(1).map(s => s.name).join(' > ')}</font>`;
        }
        
        if (lastUsedSkills.length > 0) {
            msg += `<br/><font color="#888888" size="14">Prev: ${lastUsedSkills.map(s => s.name).join(' < ')}</font>`;
        }
        
        // Temporary UI using dungeon event message
        mod.send('S_DUNGEON_EVENT_MESSAGE', 2, {
            type: 33,
            chat: false,
            channel: 0,
            message: msg
        });
    }

};
