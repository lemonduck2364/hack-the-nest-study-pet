'use strict';

// Authored red panda atlas coordinates and frame timing.
globalThis.RedPandaSprites = {
  "clips" : {
    "cat" : [
      {
        "ms" : 520,
        "pose" : "catHold"
      },
      {
        "ms" : 260,
        "pose" : "catStroke"
      },
      {
        "ms" : 120,
        "pose" : "catHold"
      }
    ],
    "catEnter" : [
      {
        "ms" : 70,
        "pose" : "idle"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 120,
        "pose" : "sit"
      },
      {
        "ms" : 130,
        "pose" : "catHold"
      }
    ],
    "catExit" : [
      {
        "ms" : 110,
        "pose" : "catHold"
      },
      {
        "ms" : 130,
        "pose" : "sit"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 120,
        "pose" : "idle"
      }
    ],
    "cube" : [
      {
        "ms" : 470,
        "pose" : "cubeHold"
      },
      {
        "ms" : 230,
        "pose" : "cubeTurn"
      },
      {
        "ms" : 130,
        "pose" : "cubeHold"
      }
    ],
    "cubeEnter" : [
      {
        "ms" : 70,
        "pose" : "idle"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 120,
        "pose" : "sit"
      },
      {
        "ms" : 100,
        "pose" : "cubeHold"
      }
    ],
    "cubeExit" : [
      {
        "ms" : 110,
        "pose" : "cubeHold"
      },
      {
        "ms" : 130,
        "pose" : "sit"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 120,
        "pose" : "idle"
      }
    ],
    "idle" : [
      {
        "ms" : 1400,
        "pose" : "idle"
      },
      {
        "ms" : 110,
        "pose" : "half"
      },
      {
        "ms" : 150,
        "pose" : "blink"
      },
      {
        "ms" : 110,
        "pose" : "half"
      },
      {
        "ms" : 400,
        "pose" : "idle"
      }
    ],
    "laptop" : [
      {
        "ms" : 150,
        "pose" : "typingUp"
      },
      {
        "ms" : 90,
        "pose" : "typingDown"
      }
    ],
    "laptopEnter" : [
      {
        "ms" : 260,
        "pose" : "idle"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 160,
        "pose" : "sit"
      },
      {
        "ms" : 100,
        "pose" : "pickUp"
      },
      {
        "ms" : 250,
        "pose" : "closed"
      },
      {
        "ms" : 120,
        "pose" : "reach"
      },
      {
        "ms" : 140,
        "pose" : "halfOpen"
      },
      {
        "ms" : 100,
        "pose" : "typingUp"
      }
    ],
    "laptopExit" : [
      {
        "ms" : 140,
        "pose" : "typingUp"
      },
      {
        "ms" : 140,
        "pose" : "halfOpen"
      },
      {
        "ms" : 100,
        "pose" : "reach"
      },
      {
        "ms" : 140,
        "pose" : "closed"
      },
      {
        "ms" : 100,
        "pose" : "pickUp"
      },
      {
        "ms" : 150,
        "pose" : "sit"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 350,
        "pose" : "idle"
      }
    ],
    "rest" : [
      {
        "ms" : 520,
        "pose" : "drowsyStart"
      },
      {
        "ms" : 340,
        "pose" : "drowsyBlink"
      },
      {
        "ms" : 470,
        "pose" : "drowsyFloat"
      },
      {
        "ms" : 280,
        "pose" : "idle"
      }
    ],
    "sleep" : [
      {
        "ms" : 540,
        "pose" : "sleep"
      },
      {
        "ms" : 500,
        "pose" : "sleepBreath"
      },
      {
        "ms" : 370,
        "pose" : "sleepFloat"
      }
    ],
    "sleepEnter" : [
      {
        "ms" : 70,
        "pose" : "idle"
      },
      {
        "ms" : 160,
        "pose" : "drowsyStart"
      },
      {
        "ms" : 120,
        "pose" : "crouch"
      },
      {
        "ms" : 170,
        "pose" : "sleepySeat"
      },
      {
        "ms" : 160,
        "pose" : "settling"
      },
      {
        "ms" : 170,
        "pose" : "sleep"
      }
    ],
    "sleepExit" : [
      {
        "ms" : 100,
        "pose" : "sleep"
      },
      {
        "ms" : 150,
        "pose" : "settling"
      },
      {
        "ms" : 150,
        "pose" : "sleepySeat"
      },
      {
        "ms" : 130,
        "pose" : "crouch"
      },
      {
        "ms" : 130,
        "pose" : "half"
      },
      {
        "ms" : 130,
        "pose" : "idle"
      }
    ],
    "wave" : [
      {
        "ms" : 60,
        "pose" : "idle"
      },
      {
        "ms" : 100,
        "pose" : "waveUp"
      },
      {
        "ms" : 140,
        "pose" : "waveOut"
      },
      {
        "ms" : 130,
        "pose" : "waveIn"
      },
      {
        "ms" : 130,
        "pose" : "waveOut"
      },
      {
        "ms" : 120,
        "pose" : "waveUp"
      },
      {
        "ms" : 100,
        "pose" : "idle"
      }
    ]
  },
  "columns" : 8,
  "height" : 82,
  "poses" : {
    "blink" : {
      "index" : 2
    },
    "catHold" : {
      "eyes" : 3,
      "index" : 10
    },
    "catStroke" : {
      "eyes" : 3,
      "index" : 11
    },
    "closed" : {
      "eyes" : 3,
      "index" : 17
    },
    "crouch" : {
      "eyes" : 1,
      "index" : 6
    },
    "cubeHold" : {
      "eyes" : 3,
      "index" : 8
    },
    "cubeTurn" : {
      "eyes" : 3,
      "index" : 9
    },
    "drowsyBlink" : {
      "effect" : 31,
      "index" : 2
    },
    "drowsyFloat" : {
      "effect" : 32,
      "index" : 1
    },
    "drowsyStart" : {
      "effect" : 30,
      "index" : 1
    },
    "eyes_e" : {
      "index" : 26
    },
    "eyes_n" : {
      "index" : 23
    },
    "eyes_ne" : {
      "index" : 24
    },
    "eyes_nw" : {
      "index" : 22
    },
    "eyes_s" : {
      "index" : 28
    },
    "eyes_se" : {
      "index" : 29
    },
    "eyes_sw" : {
      "index" : 27
    },
    "eyes_w" : {
      "index" : 25
    },
    "half" : {
      "index" : 1
    },
    "halfOpen" : {
      "eyes" : 3,
      "index" : 19
    },
    "idle" : {
      "eyes" : 0,
      "index" : 0
    },
    "pickUp" : {
      "eyes" : 3,
      "index" : 16
    },
    "reach" : {
      "eyes" : 3,
      "index" : 18
    },
    "settling" : {
      "index" : 13
    },
    "sit" : {
      "eyes" : 3,
      "index" : 7
    },
    "sleep" : {
      "effect" : 30,
      "index" : 14
    },
    "sleepBase" : {
      "index" : 14
    },
    "sleepBreath" : {
      "effect" : 31,
      "index" : 15
    },
    "sleepBreathBase" : {
      "index" : 15
    },
    "sleepFloat" : {
      "effect" : 32,
      "index" : 14
    },
    "sleepySeat" : {
      "index" : 12
    },
    "typingDown" : {
      "eyes" : 3,
      "index" : 21
    },
    "typingUp" : {
      "eyes" : 3,
      "index" : 20
    },
    "waveIn" : {
      "eyes" : 0,
      "index" : 5
    },
    "waveOut" : {
      "eyes" : 0,
      "index" : 4
    },
    "waveUp" : {
      "eyes" : 0,
      "index" : 3
    },
    "zzz1" : {
      "index" : 30
    },
    "zzz2" : {
      "index" : 31
    },
    "zzz3" : {
      "index" : 32
    }
  },
  "width" : 78
};
