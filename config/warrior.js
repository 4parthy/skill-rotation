'use strict';

module.exports = [
    // Warrior rotation example
    {
        name: 'Deadly Gamble',
        id: 200100,
        buffs: {
            Self: { missing: [200100, 200101] } // Only suggest if not active
        }
    },
    {
        name: 'Blade Draw',
        id: 290100
    },
    {
        name: 'Scythe',
        id: 300100,
        logic: (state) => state.edge >= 8 // Custom logic for edge stacks
    },
    {
        name: 'Rain of Blows',
        id: 110100
    }
];
