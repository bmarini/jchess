jQuery ($) ->
  loadChessGame = (container, options, callback) ->
    chess = $('.board', container).chess(options)
    $('.back', container).click => 
      chess.transitionBackward()
      $('.annot', container).text( chess.annotation() )
      return false
    $('.next', container).click =>
      chess.transitionForward()
      $('.annot', container).text( chess.annotation() )
      return false
    $('.flip', container).click =>
      chess.flipBoard()
      return false
    callback(chess) if ( typeof callback != "undefined" )

  loadChessGame( '#game3',
    pgn : $('#pgn-fischer-spassky').html() )

  loadChessGame( '#game1', {} )
  loadChessGame( '#game2',
    fen : "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" )
  loadChessGame( '#game3',
    pgn : $('#pgn-fischer-spassky').html() )
  loadChessGame( '#game4',
    pgn : $('#justdoeet').html() )
  loadChessGame( '#game5',
    pgn : $('#with-queening').html() )
  loadChessGame( '#game6',
    pgn : $('#unambiguous-knight-move').html() )
  loadChessGame( '#game7',
    pgn : $('#heavily-annotated').html() )
  loadChessGame( '#game8',
    fen : $('#fen-html').html() )
  loadChessGame( '#game9',
    pgn : $('#middle-game').html() , (chess)->
      chess.transitionTo(25)
  )
