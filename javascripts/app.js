jQuery(function($) {
  function loadChessGame(container, options, callback) {
    var chess = $('.board', container).chess(options);

    $('.back', container).click(function() {
      chess.transitionBackward();
      $('.annot', container).text( chess.annotation() );
      return false;
    });

    $('.next', container).click(function() {
      chess.transitionForward();
      $('.annot', container).text( chess.annotation() );
      return false;
    });

    $('.flip', container).click(function() {
      chess.flipBoard();
      return false;
    });

    if ( typeof callback != "undefined" ) { callback(chess) };
  }

  loadChessGame( '#game1', {} );
  loadChessGame( '#game2', { fen : "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" } );
  loadChessGame( '#game3', { pgn : $('#pgn-fischer-spassky').html() } );
  loadChessGame( '#game4', { pgn : $('#justdoeet').html() } );
  loadChessGame( '#game5', { pgn : $('#with-queening').html() } );
  loadChessGame( '#game6', { pgn : $('#unambiguous-knight-move').html() } );
  loadChessGame( '#game7', { pgn : $('#heavily-annotated').html() } );
  loadChessGame( '#game8', { fen : $('#fen-html').html() } );
  loadChessGame( '#game9', { pgn : $('#middle-game').html() }, function(chess) {
    chess.transitionTo(25);
  });
 loadChessGame( '#game10', { pgn : $('#pgn-with-fen-1').html() } );
  loadChessGame( '#game11', { pgn : $('#pgn-with-fen-2').html() } );
});
