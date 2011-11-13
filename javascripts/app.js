jQuery(document).ready(function() {
	var chess1 = jQuery('#board1').chess();
	var chess2 = jQuery('#board2').chess({fen : "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"});
	var chess3 = jQuery('#board3').chess({pgn : jQuery('#pgn-fischer-spassky').html()});
	var chess4 = jQuery('#board4').chess({pgn : jQuery('#justdoeet').html()});
	var chess5 = jQuery('#board5').chess({pgn : jQuery('#with-queening').html()});
	var chess6 = jQuery('#board6').chess({pgn : jQuery('#unambiguous-knight-move').html()});

	jQuery('#board3-back').click(function() {
		chess3.transitionBackward();
		jQuery("#board3-annot").text( chess3.annotation() );
		return false;
	});

	jQuery('#board3-next').click(function() {
		chess3.transitionForward();
		jQuery("#board3-annot").text( chess3.annotation() );
		return false;
	});

	jQuery('#board3-flip').click(function() {
		chess3.flipBoard();
		return false;
	});  

	jQuery('#board4-back').click(function() {
		chess4.transitionBackward();
		return false;
	});

	jQuery('#board4-next').click(function() {
		chess4.transitionForward();
		return false;
	});

	jQuery('#board4-flip').click(function() {
		chess4.flipBoard();
		return false;
	}); 

	jQuery('#board5-back').click(function() {
		chess5.transitionBackward();
		return false;
	});

	jQuery('#board5-next').click(function() {
		chess5.transitionForward();
		return false;
	});

	jQuery('#board5-flip').click(function() {
		chess5.flipBoard();
		return false;
	}); 

	jQuery('#board6-back').click(function() {
		chess6.transitionBackward();
		return false;
	});

	jQuery('#board6-next').click(function() {
		chess6.transitionForward();
		return false;
	});

	jQuery('#board6-flip').click(function() {
		chess6.flipBoard();
		return false;
	});  
})
