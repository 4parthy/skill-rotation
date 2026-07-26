'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const berserkerConfig = require('../config/berserker');
const RotationEngine = require('../lib/rotation-engine');

function createEngine() {
    const readiness = new Map();
    const hooks = new Map();
    const logs = [];
    const events = new EventEmitter();
    const skillUses = [];
    const mod = {
        hook(name, version, options, callback) {
            if (typeof options === 'function') {
                callback = options;
                options = undefined;
            }
            hooks.set(name, { version, options, callback });
        },
        log(message) {
            logs.push(message);
        }
    };
    const stateTracker = {
        isSkillReady(skill) {
            const group = Math.floor(skill.id / 10000);
            return readiness.get(group) !== false;
        }
    };

    events.on('skill-used', (group, skill, source) => skillUses.push({ group, skill, source }));

    return {
        engine: new RotationEngine(mod, stateTracker, events),
        hooks,
        logs,
        readiness,
        skillUses
    };
}

function names(rotation) {
    return rotation.map(s => s.name);
}

const config = berserkerConfig;
const groups = config.map(skill => Math.floor(skill.id / 10000));

assert.deepStrictEqual(groups, [3, 10, 15, 18, 25]);

const { engine, hooks, logs, readiness, skillUses } = createEngine();

engine.update(config);
assert.deepStrictEqual(names(engine.currentRotation), [
    'Thunder Strike',
    'Cyclone',
    'Vampiric Blow',
    'Lethal Strike'
]);

// Using another tracked skill must not consume the currently expected step.
assert.strictEqual(engine.skillUsed(10, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Thunder Strike');
assert(logs.some(message => message.includes('Kept rotation position: expected group 3, observed tracked group 10')));

assert.strictEqual(engine.skillUsed(3, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Cyclone');

assert.strictEqual(engine.skillUsed(10, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Vampiric Blow');

assert.strictEqual(engine.skillUsed(18, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Vampiric Blow');

assert.strictEqual(engine.skillUsed(15, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Lethal Strike');

assert.strictEqual(engine.skillUsed(18, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Raze');

assert.strictEqual(engine.skillUsed(3, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Raze');

assert.strictEqual(engine.skillUsed(25, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Thunder Strike');

// Non-cooldown conditions can still make an unavailable skill get skipped.
readiness.set(10, false);
assert.strictEqual(engine.skillUsed(3, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Vampiric Blow');

assert.strictEqual(engine.skillUsed(99, config), false);
assert(logs.some(message => message.includes('Used skill group 99 is not tracked by the active rotation config.')));

const clientStartHook = hooks.get('C_START_SKILL');
assert(clientStartHook);
assert.strictEqual(clientStartHook.options.order, -10000);
assert.deepStrictEqual(clientStartHook.options.filter, { fake: null, modified: null, silenced: null });

clientStartHook.callback({ skill: { id: 150930 } });
assert.deepStrictEqual(skillUses, [{
    group: 15,
    skill: { id: 150930 },
    source: 'client-start'
}]);

console.log('rotation-engine tests passed');
