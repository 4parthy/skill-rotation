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
        this.enabled = (this.mod.settings && this.mod.settings.enabled !== false);
        this.rotation = (this.mod.settings && this.mod.settings.rotation) || {};
        this.recentSkillUses = new Map();
        this.skillUseDedupeMs = 500;

        this.events.on('state-changed', () => {
            this.update();
        });
        this.events.on('skill-used', (group, skill, source = 'unknown') => {
            if (group == null) {
                this.mod.log(`Skill use observed (${source}) without a usable group: ${this.engine.describeSkill(skill)}`);
                return;
            }

            const now = Date.now();
            const lastSeen = this.recentSkillUses.get(group) || 0;
            if (now - lastSeen < this.skillUseDedupeMs) return;
            this.recentSkillUses.set(group, now);

            this.mod.log(`Skill used (${source}): group=${group}, ${this.engine.describeSkill(skill)}`);
            if (this.engine.skillUsed(group, this.config)) {
                this.update(true);
            }
        });

        mod.command.add('sr', {
            '$none': () => {
                this.enabled = !this.enabled;
                if (this.mod.settings) {
                    this.mod.settings.enabled = this.enabled;
                }
                const class_name = this.me.class;
                const configName = class_name ? (this.rotation[class_name] || class_name) : 'none';
                this.mod.command.message(`Skill Rotation mod ${this.enabled ? 'enabled' : 'disabled'}. Current rotation: ${configName}`);
                this.update();
            },
            'reload': () => {
                this.loadConfig();
                this.mod.command.message('Rotation reloaded.');
            },
            '$default': (name) => {
                const class_name = this.me.class;
                if (!class_name) {
                    this.mod.command.message('Error: Could not determine class.');
                    return;
                }

                if (name === 'default') {
                    delete this.rotation[class_name];
                    this.mod.command.message(`Reset to default rotation for ${class_name}.`);
                    if (this.mod.settings) {
                        this.mod.settings.rotation = this.rotation;
                    }
                    this.loadConfig();
                } else {
                    const configPath = path.join(__dirname, 'config', `${name}.js`);
                    try {
                        require.resolve(configPath);
                        this.rotation[class_name] = name;
                        this.mod.command.message(`Set custom rotation for ${class_name}: ${name}`);
                        if (this.mod.settings) {
                            this.mod.settings.rotation = this.rotation;
                        }
                        this.loadConfig();
                    } catch (e) {
                        this.mod.command.message(`Error: Configuration file "${name}.js" not found in config directory.`);
                    }
                }
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
            this.mod.log(`Detected class: ${class_name}`);
            if (class_name) {
                const configName = this.rotation[class_name] || class_name;
                const configPath = path.join(__dirname, 'config', `${configName}.js`);
                this.mod.log(`Attempting to load config: ${configPath}`);
                const resolvedPath = require.resolve(configPath);
                delete require.cache[resolvedPath];
                this.config = require(resolvedPath);
                this.mod.log(`Successfully loaded rotation for ${class_name} (config: ${configName})`);
                this.mod.log(`Active rotation skills: ${this.config.map(skill => `${skill.name} (${this.engine.describeSkill(skill)})`).join(', ')}`);
                this.update();
            } else {
                this.mod.warn('Could not determine character class. Is the player logged in?');
            }
        } catch (e) {
            this.mod.warn(`No rotation config found for class ${this.me.class}: ${e.message}`);
            this.config = [];
        }
    }

    update(force = false) {
        this.mod.log(`Updating rotation. In combat: ${this.state.inCombat}, Config size: ${this.config.length}, Enabled: ${this.enabled}, Force: ${force}`);
        if (!this.enabled) {
            this.ui.clear();
            return;
        }
        this.engine.update(this.config);
        this.ui.display(this.engine.currentRotation, this.engine.lastUsedSkills, this.state.inCombat, force);
    }
}

module.exports = { NetworkMod: SkillRotation };
