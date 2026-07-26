'use strict';

const assert = require('assert');
const EventEmitter = require('events');
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

function skill(name, group) {
    return {
        name,
        id: group * 10000 + 100
    };
}

function names(rotation) {
    return rotation.map(s => s.name);
}

const config = [
    skill('Thunder Strike', 2),
    skill('Cyclone', 3),
    skill('Vampiric Blow', 4),
    skill('Lethal Strike', 10),
    skill('Raze', 21)
];

const { engine, hooks, logs, readiness, skillUses } = createEngine();

engine.update(config);
assert.deepStrictEqual(names(engine.currentRotation), [
    'Thunder Strike',
    'Cyclone',
    'Vampiric Blow',
    'Lethal Strike'
]);

// Using another tracked skill must not consume the currently expected step.
assert.strictEqual(engine.skillUsed(3, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Thunder Strike');
assert(logs.some(message => message.includes('Kept rotation position: expected group 2, observed tracked group 3')));

assert.strictEqual(engine.skillUsed(2, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Cyclone');

assert.strictEqual(engine.skillUsed(3, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Vampiric Blow');

assert.strictEqual(engine.skillUsed(10, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Vampiric Blow');

assert.strictEqual(engine.skillUsed(4, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Lethal Strike');

// Non-cooldown conditions can still make an unavailable skill get skipped.
readiness.set(21, false);
assert.strictEqual(engine.skillUsed(10, config), true);
engine.update(config);
assert.strictEqual(engine.currentRotation[0].name, 'Thunder Strike');

assert.strictEqual(engine.skillUsed(99, config), false);
assert(logs.some(message => message.includes('Used skill group 99 is not tracked by the active rotation config.')));

const clientStartHook = hooks.get('C_START_SKILL');
assert(clientStartHook);
assert.strictEqual(clientStartHook.options.order, -10000);
assert.deepStrictEqual(clientStartHook.options.filter, { fake: null, modified: null, silenced: null });

clientStartHook.callback({ skill: { id: 40930 } });
assert.deepStrictEqual(skillUses, [{
    group: 4,
    skill: { id: 40930 },
    source: 'client-start'
}]);

console.log('rotation-engine tests passed');
