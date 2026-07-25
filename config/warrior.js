'use strict';

module.exports = [
    // Warrior rotation example
    {
        name: 'Deadly Gamble',
        id: 200100,
        cooldown: true,
        buffs: {
            Self: { missing: [200100, 200101] } // Only suggest if not active
        }
    },
    {
        name: 'Blade Draw',
        id: 290100,
        cooldown: true,
        // Priority high if it's off cooldown
    },
    {
        name: 'Scythe',
        id: 300100,
        cooldown: true,
        logic: (state) => state.edge >= 8 // Custom logic for edge stacks
    },
    {
        name: 'Rain of Blows',
        id: 110100,
        cooldown: true
    }
];
