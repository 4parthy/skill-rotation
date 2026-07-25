'use strict';

const path = require('path');
const StateTracker = require('./lib/state-tracker');
const RotationEngine = require('./lib/rotation-engine');
const UIHandler = require('./lib/ui-handler');

module.exports = function SkillRotation(mod) {
    const { me } = mod.require['tera-game-state'];

    const state = new StateTracker(mod);
    const engine = new RotationEngine(mod, state);
    const ui = new UIHandler(mod);

    let config = [];

    function loadConfig() {
        try {
            const class_name = me.class;
            if (class_name) {
                const configPath = path.join(__dirname, 'config', `${class_name}.js`);
                const resolvedPath = require.resolve(configPath);
                delete require.cache[resolvedPath];
                config = require(resolvedPath);
                mod.log(`Loaded rotation for ${class_name}`);
                update();
            }
        } catch (e) {
            mod.warn(`No rotation config found for class ${me.class}: ${e.message}`);
            config = [];
        }
    }

    function update() {
        engine.update(config);
        ui.display(engine.currentRotation, engine.lastUsedSkills, state.inCombat);
    }

    mod.on('state-changed', update);
    
    mod.on('skill-used', (group) => {
        if (engine.skillUsed(group, config)) {
            update();
        }
    });

    mod.game.on('enter_game', loadConfig);
    if (mod.game.me.inGame) loadConfig();
};
