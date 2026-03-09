var GAME_WIDTH  = 800;
var GAME_HEIGHT = 512;
var TILE_SIZE   = 32;

var game = new Phaser.Game({
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 600 }, debug: false }
    },
    scene: [
        BootScene,
        MenuScene,
        GameScene,
        UIScene,
        StoryScene,
        GameOverScene,
        WinScene
    ]
});
