jQuery(document).ready(function() {
	var chess1 = jQuery('#board1').chess();
	var chess2 = jQuery('#board2').chess({fen : "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"});
	var chess3 = jQuery('#board3').chess({pgn : jQuery('#pgn-fischer-spassky').html()});
	var chess4 = jQuery('#board4').chess({pgn : jQuery('#justdoeet').html()});
	var chess5 = jQuery('#board5').chess({pgn : jQuery('#with-queening').html()});
	var chess6 = jQuery('#board6').chess({pgn : jQuery('#unambiguous-knight-move').html()});
	var chess7 = jQuery('#board7').chess({pgn : jQuery('#middle-game').html()});
	var chess8 = jQuery('#board8').chess({fen : jQuery('#fen-example').html()});
	var chess9 = jQuery('#board9').chess({pgn : jQuery('#annotations').html()});

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

	chess7.transitionTo(25);

	jQuery('#board7-back').click(function() {
		chess7.transitionBackward();
		return false;
	});

	jQuery('#board7-next').click(function() {
		chess7.transitionForward();
		return false;
	});

	jQuery('#board7-flip').click(function() {
		chess7.flipBoard();
		return false;
	});  
	
	jQuery('#board9-back').click(function() {
		chess9.transitionBackward();
		jQuery("#board9-annot").text( chess9.annotation() );
		return false;
	});

	jQuery('#board9-next').click(function() {
		chess9.transitionForward();
		jQuery("#board9-annot").text( chess9.annotation() );
		return false;
	});

	jQuery('#board9-flip').click(function() {
		chess9.flipBoard();
		return false;
	});  
})
