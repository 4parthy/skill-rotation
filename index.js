'use strict';

const path = require('path');
const EventEmitter = require('events');
const StateTracker = require('./lib/state-tracker');
const RotationEngine = require('./lib/rotation-engine');
const UIHandler = require('./lib/ui-handler');

class SkillRotation {
    constructor(mod) {
        this.mod = mod;
        this.events = new EventEmitter();

        const { me } = mod.require['tera-game-state'];
        this.me = me;

        this.state = new StateTracker(mod, this.events);
        this.engine = new RotationEngine(mod, this.state, this.events);
        this.ui = new UIHandler(mod);

        this.config = [];

        this.events.on('state-changed', () => this.update());
        this.events.on('skill-used', (group) => {
            this.mod.log(`Skill used: ${group}`);
            if (this.engine.skillUsed(group, this.config)) {
                this.update();
            }
        });

        mod.game.on('enter_game', () => {
            this.mod.log('Entered game');
            this.loadConfig();
        });

        mod.hook('S_LOGIN', '*', (event) => {
            this.mod.log(`S_LOGIN: ${event.name} (${event.class})`);
            // loadConfig will be called by enter_game which usually follows S_LOGIN
        });

        if (mod.game.me.inGame) {
            this.mod.log('Already in game');
            this.loadConfig();
        }
    }

    loadConfig() {
        try {
            const class_name = this.me.class;
            this.mod.log(`Loading config for class: ${class_name}`);
            if (class_name) {
                const configPath = path.join(__dirname, 'config', `${class_name}.js`);
                const resolvedPath = require.resolve(configPath);
                delete require.cache[resolvedPath];
                this.config = require(resolvedPath);
                this.mod.log(`Loaded rotation for ${class_name}`);
                this.update();
            }
        } catch (e) {
            this.mod.warn(`No rotation config found for class ${this.me.class}: ${e.message}`);
            this.config = [];
        }
    }

    update() {
        this.mod.log(`Updating rotation. In combat: ${this.state.inCombat}, Config size: ${this.config.length}`);
        this.engine.update(this.config);
        this.ui.display(this.engine.currentRotation, this.engine.lastUsedSkills, this.state.inCombat);
    }
}

module.exports = { NetworkMod: SkillRotation };
