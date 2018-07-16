
class Lobby {

  constructor(socket) {
    this._socket = socket;
    this._gameId = null;
    this._gameChannel = null;
    this._chatChannel = null;
    this._joinCallbacks = [];
    this._leaveCallbacks = [];
    this._rejoinCallbacks = [];
    this._gameInfo = {};

    this._setupControls();

    this._setupGameList();
  }


  onJoin(callback) {
    this._joinCallbacks.push(callback);
  }


  onRejoin(callback) {
    this._rejoinCallbacks.push(callback);
  }


  onLeave(callback) {
    this._leaveCallbacks.push(callback);
  }


  _setupControls() {
    $('#tanx-leave-btn').on('click', () => {
      this._leave();
    });
    $('#tanx-create-btn').on('click', () => {
      this._create($('#tanx-game-name-field').val());
    });

    $('#tanx-name-field')
      .on('keyup', (event) => {
        this._renamePlayer();
        event.stopPropagation();
      })
      .on('keydown', (event) => {
        event.stopPropagation();
      });

    this._leave();
  }


  _setupGameList() {
    this._lobbyChannel = this._socket.channel("lobby", {});

    let lobbyJoiner = this._lobbyChannel.join();

    this._lobbyChannel.on("update", update => {
      this._updateGameTable(update.g)
      $('#client-node-name').text(update.d);
      this._gameInfo = {};
      update.g.forEach((game) => {
        this._gameInfo[game.i] = game;
      });
    });
    this._lobbyChannel.on("created", (meta) => {
      this._join(meta.id);
    });
  }


  _updateGameTable(games) {
    $('.tanx-game-row').remove();
    let createGameRow = $('#create-game-row');
    games.forEach(game => {
      $('<tr>').addClass("tanx-game-row")
        .append($('<td>').text(game.n || "(Untitled game)"))
        .append($('<td>').text(game.d))
        .on('click', (event) => {
          this._join(game.i);
        })
        .insertBefore(createGameRow);
    });
  }


  _create(gameName) {
    if (this._gameId != null) return;
    this._lobbyChannel.push("create", {name: gameName});
  }


  _join(gameId) {
    if (this._gameId != null) return;

    let playerName = this._escapedTankName();
    let gameChannel = this._socket.channel("game:" + gameId, {name: playerName});
    let chatChannel = this._socket.channel("chat:" + gameId, {});

    gameChannel.onError(reason => {
      this._gameChannel = null;
    });
    chatChannel.onError(reason => {
      this._chatChannel = null;
    });

    let gameJoiner = gameChannel.join();
    gameJoiner.receive("ok", reply => {
      this._gameChannel = gameChannel;
      if (this._gameId == null) {
        gameJoiner.payload.id = reply.i;
        if (this._chatChannel) {
          this._finishJoin(gameId);
        }
      } else {
        if (this._chatChannel) {
          this._finishRejoin();
        }
      }
    });

    let chatJoiner = chatChannel.join();
    chatJoiner.receive("ok", reply => {
      this._chatChannel = chatChannel;
      if (this._gameId == null) {
        if (this._gameChannel) {
          this._finishJoin(gameId);
        }
      } else {
        if (this._gameChannel) {
          this._finishRejoin();
        }
      }
    });
  }


  _finishJoin(gameId) {
    let game = this._gameInfo[gameId];
    $('#game-name-span').text(game.n);
    $('#game-node-span').text(game.d);

    $('#tanx-game-list').hide();
    $('#tanx-game-info').show();

    this._gameId = gameId;
    this._joinCallbacks.forEach(callback => {
      callback(gameId, this._gameChannel, this._chatChannel);
    });
  }


  _finishRejoin() {
    this._rejoinCallbacks.forEach(callback => {
      callback(this._gameId, this._gameChannel, this._chatChannel);
    });
  }


  _leave() {
    $('#tanx-game-list').show();
    $('#tanx-game-info').hide();

    $('#game-name-span').text('');
    $('#game-node-span').text('');

    let backgroundMusic = $('#background-music')[0];
    backgroundMusic.pause();
    if (backgroundMusic.currentTime) {
      backgroundMusic.currentTime = "0";
    }

    if (this._gameId == null) return;

    let gameId = this._gameId;
    let gameChannel = this._gameChannel;
    let chatChannel = this._chatChannel;
    this._gameChannel = null;
    this._chatChannel = null;
    this._gameId = null;
    this._leaveCallbacks.forEach(callback => {
      callback(gameId, gameChannel, chatChannel);
    });
    gameChannel.leave();
    chatChannel.leave();
  }


  _renamePlayer() {
    if (this._gameId != null) {
      this._gameChannel.push("rename", {name: this._escapedTankName()});
    }
  }


  _escapedTankName(){
    return this._escapeHtml($('#tanx-name-field').val())
  }


  _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML
  }

}


export default Lobby;