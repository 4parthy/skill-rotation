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
            if (this.engine.skillUsed(group, this.config)) {
                this.update();
            }
        });

        mod.game.on('enter_game', () => this.loadConfig());
        if (mod.game.me.inGame) this.loadConfig();
    }

    loadConfig() {
        try {
            const class_name = this.me.class;
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
        this.engine.update(this.config);
        this.ui.display(this.engine.currentRotation, this.engine.lastUsedSkills, this.state.inCombat);
    }
}

module.exports = { NetworkMod: SkillRotation };
