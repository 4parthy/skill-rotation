'use strict';

module.exports = [
    // Berserker rotation
    {
        name: 'Unleash',
        id: 310100, // Group 31
        cooldown: true,
        buffs: {
            Self: { missing: [401705] } // Only suggest if not already unleashed
        }
    },
    {
        name: 'Bloodlust',
        id: 200100, // Group 20
        cooldown: true,
        buffs: {
            Self: { missing: [400700, 400701, 400705] }
        }
    },
    {
        name: 'Fiery Rage',
        id: 80100, // Group 8
        cooldown: true,
        buffs: {
            Self: { missing: [400100, 400101, 400102, 400103, 400104, 400105] }
        }
    },
    {
        name: 'Thunder Strike',
        id: 20100, // Group 2
        cooldown: true
    },
    {
        name: 'Cyclone',
        id: 30100, // Group 3
        cooldown: true
    },
    {
        name: 'Vampiric Blow',
        id: 40100, // Group 4
        cooldown: true
    },
    {
        name: 'Lethal Strike',
        id: 100100, // Group 10
        cooldown: true
    },
    {
        name: 'Raze',
        id: 210100, // Group 21
        cooldown: true
    }
];
