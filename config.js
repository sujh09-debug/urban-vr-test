window.URBAN_VR_CONFIG = {
  mode: 'glb',
  start: { round: 1, variant: 'A' },

  rounds: [
    {
      number: 1,
      label: 'Street Scale',
      variants: [
        {
          id: 'A',
          file: 'r1_a.glb',
          type: 'street',
          width: 9,
          height: 11,
          length: 50,
          views: [
            { id: 'P1', x: 4.34, z: -24 },
            { id: 'P2', x: 0, z: -5 }
          ]
        },
        {
          id: 'B',
          file: 'r1_b.glb',
          type: 'street',
          width: 20,
          height: 17,
          length: 50,
          views: [
            { id: 'P1', x: 0, z: 15 },
            { id: 'P2', x: 0, z: -5 }
          ]
        }
      ]
    },

    {
      number: 2,
      label: 'Podium',
      variants: [
        {
          id: 'A',
          file: 'r2_a.glb',
          type: 'street',
          width: 21,
          height: 31,
          length: 50,
          views: [
            { id: 'P1', x: 0, z: 15 },
            { id: 'P2', x: 0, z: -5 }
          ]
        },
        {
          id: 'B',
          file: 'r2_b.glb',
          type: 'podium',
          width: 21,
          height: 31,
          length: 50,
          views: [
            { id: 'P1', x: 0, z: 15 },
            { id: 'P2', x: 0, z: -5 }
          ]
        }
      ]
    },

    {
      number: 3,
      label: 'Plaza',
      variants: [
        {
          id: 'A',
          file: 'r3_a.glb',
          type: 'plaza',
          plazaWidth: 44,
          plazaDepth: 44,
          views: [
            { id: 'P1', x: 0, z: 16 },
            { id: 'P2', x: 10, z: 0 }
          ]
        },
        {
          id: 'B',
          file: 'r3_b.glb',
          type: 'plaza',
          plazaWidth: 26,
          plazaDepth: 26,
          views: [
            { id: 'P1', x: 0, z: 8 },
            { id: 'P2', x: 5, z: 0 }
          ]
        }
      ]
    },

    {
      number: 4,
      label: 'D/H',
      variants: [
        {
          id: 'A',
          file: 'r4_a.glb',
          type: 'street',
          width: 9,
          height: 9,
          length: 50,
          views: [
            { id: 'P1', x: 0, z: 15 },
            { id: 'P2', x: 0, z: -5 }
          ]
        },
        {
          id: 'B',
          file: 'r4_b.glb',
          type: 'street',
          width: 27,
          height: 27,
          length: 50,
          views: [
            { id: 'P1', x: 0, z: 15 },
            { id: 'P2', x: 0, z: -5 }
          ]
        }
      ]
    }
  ]
};
