jQuery(document).ready(function() {
  //var chess1 = jQuery('#board1').chess();
  //var chess2 = jQuery('#board2').chess({fen : "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"});
  var chess3 = jQuery('#board3').chess({pgn : jQuery('#justdoeet').html()});


  jQuery('#back').click(function() {
    chess3.transitionBackward();
    return false;
  });
  jQuery('#next').click(function() {
    chess3.transitionForward();
    return false;
  });
  
  // jQuery.each(chess3.game.transitions, function() {
  //   console.log(this.forward.join('|'));
  //   console.log(this.backward.join('|'));
  // });
})
