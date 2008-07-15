/*
 * jChess 0.0.1 - Chess Library Built From jQuery
 *
 * Copyright (c) 2008 Ben Marini
 */
 
(function($) {
  /* Constructor */
  $.chess = function(options, wrapper) {
    this.settings = $.extend( {}, $.chess.defaults, options );
    this.wrapper  = wrapper;
  }
  
  /* Add chess() to the jQuery namespace */
  $.fn.chess = function(options) {
    var chess = new $.chess(options, this[0]);
    chess.init();
    return chess;
  }

  $.extend($.chess, {
    
    defaults : {
      fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      square_size : 43,
      board_element_selector : '.chess-board'
    },
    
    prototype : {
      init : function() {
        this.setUpBoard( this.parseFEN( this.settings.fen ) );
        if (this.settings.pgn) this.parsePGN(this.settings.pgn);

        this.setUpBoard( this.parseFEN( this.settings.fen ) );
        this.writeBoard();
      },

      boardElement : function() {
        return $(this.wrapper).find(this.settings.board_element_selector);
      },
      
      boardData : function() {
        return this._board;
      },
      
      setUpBoard : function(template) {
        this._board = this.createBoardDataFromTemplate(template);
      },
      
      createBoardDataFromTemplate : function(template) {
        var board = [];
        $.each(template, function(j, row) {
          board[j] = [];
          $.each(row, function(k, val) {
            if (val != '-') {
              board[j][k] = { id: (k + 1) + (j * 8) , piece: template[j][k].toString() };
            } else {
              board[j][k] = '-';
            }
          })
        })

        return board;
      },
      
      writeBoard : function() {
        if (this.boardElement().size() == 0) {
          $(this.wrapper).append('<div class="chess-board"></div>');
        }

        var instance = this;
        
        $.each(instance.boardData(), function(j, row) {
          $.each(row, function(k, val) {
            var piece = instance.boardData()[j][k];
            var square = instance.coord2Algebriac(j,k);

            if (piece != '-') instance.addDomPiece(piece.id, piece.piece, square);
          })
        })
      },
      
      addDomPiece : function(id, piece, algebriac) {
        var square   = this.algebriac2Coord(algebriac);
        var pos_top  = this.settings.square_size * square[0];
        var pos_left = this.settings.square_size * square[1];
        
        this.boardElement().append('<div id="piece_' + id + '" class="' + piece + '"></div>');
        $('#piece_' + id).css({ position: 'absolute', top:pos_top, left:pos_left });
      },
      
      moveDomPiece : function(id, move) {
        var from = this.algebriac2Coord(move.from);
        var to   = this.algebriac2Coord(move.to);
        
        var top  = (parseInt(to[0]) - parseInt(from[0])) * this.settings.square_size;
		    var left = (parseInt(to[1]) - parseInt(from[1])) * this.settings.square_size;
	      
        $('#piece_' + id).animate({
          'top' : '+=' + top + 'px', 'left' : '+=' + left + 'px'
        }, 'fast');
      },
      
      removeDomPiece : function(id) {
        $('#piece_' + id).remove();
      },
      
      transitionForward : function() {
        console.log(this.game.transitions.length);
        console.log(this.game.halfmove_number);
        if (this.game.halfmove_number < this.game.transitions.length) {
          this.runTransitions(this.game.transitions[this.game.halfmove_number].forward);
          this.game.halfmove_number++;          
        }
      },
      
      transitionBackward : function() {
        if (this.game.halfmove_number > 0) {
          this.game.halfmove_number--;
          this.runTransitions(this.game.transitions[this.game.halfmove_number].backward);          
        }
      },
      
      // Example transitions
      // ["m:50:e2:6,1"]
      // ["a:50:P:e4", "m:6:4,1:c7"]
      // ["r:50", "m:6:d7:d8"]
      runTransitions : function(transitions) {
        var instance = this;
        $.each(transitions, function() {
          var pieces          = this.split(':');
    			var transition_type = pieces[0];
    			var id              = pieces[1];
    			
    			switch(transition_type) {
    			  case 'r':
    			    instance.removeDomPiece(id);
    			    break;
    			  case 'm':
    			    instance.moveDomPiece(id, { from : pieces[2], to : pieces[3] });
    			    break;
    			  case 'a':
    			    instance.addDomPiece(id, pieces[2], pieces[3]);
    			    break;
    			}
    			
        });
      },

      clearBoard : function() {
        this.boardElement().empty();
      },

      flipBoard : function() {
        var total_height = this.settings.square_size * 7;

        this.boardElement().children().each(function() {
          var top_val      = parseInt($(this).css('top'));
          $(this).css('top', total_height - top_val);
        })
      },

      parseFEN : function(fen) {
        // rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2
        var new_board     = [];
        var fen_parts     = fen.split(/\/|\s/);
        
        for (var j = 0;j < 8; j++) {
          new_board[j] = [];
          var row = fen_parts[j].replace(/\d/g, this.replaceNumberWithDashes)
          for (var k in row) {
            new_board[j][k] = row[k];
          }
        }
        return new_board;
      },
      
      validateFEN : function(fen) {
        var pattern = /([rnbqkpRNBQKP12345678]+\/){7}([rnbqkpRNBQKP12345678]+)\s[bw-]\s(([kqKQ]{1,4})|(-))\s(([a-h][1-8])|(-))\s\d+\s\d+/
        return pattern.test(fen)
      },

      parsePGN : function(pgn) {
        // Do a little clean up on the string
        pgn = $.trim(pgn).replace(/\n|\r/g, ' ').replace(/\s+/g, ' ');
        // Remove annotations for now...
        pgn = pgn.replace(/\{[^}]+}/g, '');
  
        this.game.header['Event']  = /\[Event "([^"]*)"]/.exec(pgn)[1];
        this.game.header['Site']   = /\[Site "([^"]*)"]/.exec(pgn)[1];
        this.game.header['Date']   = /\[Date "([^"]*)"]/.exec(pgn)[1];
        this.game.header['Round']  = /\[Round "([^"]*)"]/.exec(pgn)[1];
        this.game.header['White']  = /\[White "([^"]*)"]/.exec(pgn)[1];
        this.game.header['Black']  = /\[Black "([^"]*)"]/.exec(pgn)[1];
        this.game.header['Result'] = /\[Result "([^"]*)"]/.exec(pgn)[1];
  
        // Find the body
        this.game.body = /(1\. ?(N[acfh]3|[abcdefgh][34]).*)/m.exec(pgn)[1];
  
        // Remove numbers, remove result
        this.game.body = this.game.body.replace(new RegExp("1-0|1/2-1/2|0-1"), '');
        this.game.body = this.game.body.replace(/^\d+\.+/, '');
        this.game.body = this.game.body.replace(/\s\d+\.+/g, ' ');
        
        var moves = $.trim(this.game.body).split(/\s+/);
  
        var instance = this;
        $.each(moves, function(i, move) {
          instance.game.moves[i] = move;
          
          //console.log("Processing: " + move);
          var player = (i % 2 == 0) ? 'w' : 'b';
          
          // If the move was to castle
          if ( instance.patterns.castle_queenside.test(move) ) {
            var rank = (player == 'w') ? 1 : 8;
            instance.movePiece(i, {from : "e" + rank, to : "c" + rank} );
            instance.movePiece(i, {from : "a" + rank, to : "d" + rank} );

          } else if ( instance.patterns.castle_kingside.test(move) ) {
            var rank = (player == 'w') ? 1 : 8;
            instance.movePiece(i, {from : "e" + rank, to : "g" + rank} );
            instance.movePiece(i, {from : "h" + rank, to : "f" + rank} ); 
          
          // If the move was a piece
          } else if ( instance.patterns.piece_move.test(move) ) {
            var m = instance.patterns.piece_move.exec(move);
            var piece = m[0];
            var src_file = null;
            var src_rank = null;
            var dst_file = null;
            var dst_rank = null;
            
            if ( instance.patterns.rank_and_file_given.test(move) ) {
              var m = instance.patterns.rank_and_file_given.exec(move);
              src_file = m[2];
              src_rank = m[3];
              dst_file = m[4];
              dst_rank = m[5];
            } else if ( instance.patterns.file_given.test(move) ) {
              var m = instance.patterns.file_given.exec(move);
              src_file = m[2];
              dst_file = m[3];
              dst_rank = m[4];
            } else if ( instance.patterns.rank_given.test(move) ) {
              var m = instance.patterns.rank_given.exec(move);
              src_rank = m[2];
              dst_file = m[3];
              dst_rank = m[4];
            } else if ( instance.patterns.nothing_given.test(move) ) {
              var m = instance.patterns.nothing_given.exec(move);
              dst_file = m[2];
              dst_rank = m[3];
            }
            
            var src = instance.findMoveSource(piece, src_file, src_rank, dst_file, dst_rank, player);
            instance.movePiece(i, {from : src, to : dst_file + dst_rank} );
            
            // If the move was a pawn
          } else {
            var dst_file = null;
            var dst_rank = null;
            
            if ( instance.patterns.pawn_move.test(move) ) {
              var m    = instance.patterns.pawn_move.exec(move);
              dst_file = m[1];
              dst_rank = m[2];
              var src  = instance.findPawnMoveSource(dst_file, dst_rank, player);
              var dst  = dst_file + dst_rank;
              instance.movePiece(i, {from : src, to : dst} );
              
              // Pawn capture
            } else if ( instance.patterns.pawn_capture.test(move) ) {
              var m        = instance.patterns.pawn_capture.exec(move);
              dst_file     = m[2];
              dst_rank     = m[3];
              var src_file = m[1];
              var src_rank = parseInt(dst_rank) + ( (player == 'w') ? -1 : 1 );
              
              // En passent
              var result = instance.pieceAt(dst_file + dst_rank);
              if (result == '-') instance.removePiece(i, dst_file + src_rank);
              instance.movePiece(i, {from : src_file + src_rank, to : dst_file + dst_rank });
            }
            
            // Queening
            if ( instance.patterns.pawn_queen.test(move) ) {
              var m = instance.patterns.pawn_queen.exec(move);
              var queening_piece = m[1];
              queening_piece = (player == 'w') ? queening_piece : queening_piece.toLowerCase();
              instance.addPiece(i, queening_piece, dst_file + dst_rank); 
            }
          }
  
        });
      },
      
      findMoveSource : function(piece, src_file, src_rank, dst_file, dst_rank, player) {
        if ( src_file && src_rank ) return src_file + src_rank;
        
        var dst_square = dst_file + dst_rank;
        var target_piece = (player == 'w') ? piece : piece.toLowerCase();
        target_piece = target_piece.toString();
        
        for (var i = 0; i < this.pieces[piece].vectors.length; i++) {
          var vector = this.pieces[piece].vectors[i];

          for (var size = 1; size <= vector.limit; size++) {
            var result = this.pieceFromSourceAndVector(dst_square, vector, size);
            if (result == null) break;
            if (result[0] == '-') continue;

            if (result[0].piece == target_piece) {
              if (src_file) {
                if (result[1][0].toString() == src_file) {
                  return result[1];
                }
              } else if (src_rank) {
                if (result[1][1].toString() == src_rank) {
                  return result[1];
                }
              } else {
                return result[1];
              }
            } else {
              break;
            }            
          }
        }
      },
      
      findPawnMoveSource : function(dst_file, dst_rank, player) {
        var dst_square    = dst_file + dst_rank;
        var target_piece  = (player == 'w') ? 'P' : 'p';
        var direction     = (player == 'w') ? -1 : 1;
        var vector        = { x : 0, y : direction, limit : 2 };

        for (var size = 1; size <= vector.limit; size++) {
          var result = this.pieceFromSourceAndVector(dst_square, vector, size);
          if (result == null) break;
          if (result[0].piece == target_piece) return result[1];
          if (result[0] != '-') break;
        }
      },
      
      pieceFromSourceAndVector : function(source, vector, limit) {
        var source_coords = this.algebriac2Coord(source);
        var row = source_coords[0] - (vector.y * limit);
        var col = source_coords[1] - (vector.x * limit);   

        if ( row >= 8 || row < 0 || col >= 8 || col < 0 ) return null;
        return [this._board[row][col], this.coord2Algebriac(row, col)];        
      },
      
      pieceAt : function(algebriac) {
        var square = this.algebriac2Coord(algebriac);
        return this._board[square[0]][square[1]];
      },
      
      // Ex: this.movePiece({from : 'e2', to : 'e4'})
      movePiece : function(num, move) {

        var from = this.algebriac2Coord(move.from);
        var to   = this.algebriac2Coord(move.to);
        var piece = this.pieceAt(move.from);
        
        if (this.pieceAt(move.to).piece) this.removePiece(num, move.to);
        
        this._board[to[0]][to[1]] = this._board[from[0]][from[1]];
        this._board[from[0]][from[1]] = '-';

        this.saveTransition({type: 'm', num : num, dom_id : piece.id, from : move.from, to : move.to});
      },
      
      removePiece : function(num, algebriac) {
        var piece = this.pieceAt(algebriac);

        var square = this.algebriac2Coord(algebriac);
        this._board[square[0]][square[1]] = '-';

        this.saveTransition({type: 'r', num : num, dom_id : piece.id, piece: piece.piece, from : algebriac});
      },

      addPiece : function(num, piece_char, algebriac) {

        var square = this.algebriac2Coord(algebriac);
        var id = this.getNextPieceId();
        this._board[square[0]][square[1]] = { id : id, piece : piece_char };

        this.saveTransition({type: 'a', num : num, dom_id : id, to : algebriac, piece : piece_char});
      },
      
      // transitions = { 1 : { forward : ["m:50:4,1:6,1"], backward : ["m:50:6,1:4,1"] },
      //                 2 :{ forward : ["a:50:P:4,1", "m:6:4,1:1,4"], backward : ["r:50", "m:6:1,4:4,1"] } }
      saveTransition : function(options) {
        var forward  = null;
        var backward = null;
        var num      = options.num;
        
        if (options.type == 'a') {
          forward  = ["a:" + options.dom_id + ":" + options.piece + ":" + options.to];
          backward = ["r:" + options.dom_id];          
        } else if (options.type == 'm') {
          forward  = ["m:" + options.dom_id + ":" + options.from + ":" + options.to];
          backward = ["m:" + options.dom_id + ":" + options.to + ":" + options.from];
        } else if (options.type == 'r') {
          forward  = ["r:" + options.dom_id];
          backward = ["a:" + options.dom_id + ":" + options.piece + ":" + options.from];
        }
        
        if (this.game.transitions[num] == null) {
          this.game.transitions[num] = { forward : forward, backward : backward };
        } else {
          this.game.transitions[num].forward = this.game.transitions[num].forward.concat(forward);
          this.game.transitions[num].backward = this.game.transitions[num].backward.concat(backward);
        }
      },
      
      getNextPieceId : function() {
        return this.game.nex_piece_id++;
      },

      /* Utility Functions */
      algebriac2Coord : function(algebriac) {
        return [this.rank2Row(algebriac[1]), this.file2Col(algebriac[0])];
      },
      
      coord2Algebriac : function(row, col) {
        return this.col2File(col) + this.row2Rank(row);
      },
      
      rank2Row : function(rank) {
        return 8 - parseInt(rank);
      },
      
      file2Col : function(file) {
        return file.charCodeAt(0) - ('a').charCodeAt(0);
      },
      
      row2Rank : function(row) {
        return (8 - row) + '';
      },
      
      col2File : function(col) {
        return String.fromCharCode( col + ('a').charCodeAt(0) );
      },
      
      replaceNumberWithDashes : function(str) {
        var num_spaces = parseInt(str);
        var new_str = '';
        for (var i = 0; i < num_spaces; i++) { new_str += '-'; }
        return new_str;
      },
      
      debugBoard : function() {
        $.each(this.boardData(), function(j, row) {
          $.each(row, function(k, val) {
            console.log('[' + j + ',' + k + '] = { id: ' + this.boardData()[j][k].id + ', piece: ' + this.boardData()[j][k].piece + ' }');
          })
        })
      },
      
      /* Game Attributes */
      game : {
        active_color : 'w',
        castling_availability : 'KQkq',
        en_passant_square : '-',
        halfmove_clock : 0,
        fullmove_number : 1,
        halfmove_number : 0,

        header : [],
        body : '',
        moves : [],
        annotations : [],
        
        next_piece_id : 64,
        transitions : []
      },

      /* Patterns used for parsing */
      patterns : {
        castle_kingside     : /^O-O/,
        castle_queenside    : /^O-O-O/,

        piece_move          : /^([BKNQR])/,
        rank_and_file_given : /^([BKNQR])([a-h])([1-8])x?([a-h])([1-8])/,
        file_given          : /^([BKNQR])([a-h])x?([a-h])([1-8])/,
        rank_given          : /^([BKNQR])([1-8])x?([a-h])([1-8])/,
        nothing_given       : /^([BKNQR])x?([a-h])([1-8])/,

        pawn_move           : /^([a-h])([1-8])/,
        pawn_capture        : /^([a-h])x([a-h])([1-8])/,
        pawn_queen          : /=([BNQR])/,
      },
      
      /* Definitions of pieces */
      pieces : {
        R : {
          vectors : [
            { x :  0, y :  1, limit : 8 },
            { x :  1, y :  0, limit : 8 },
            { x :  0, y : -1, limit : 8 },
            { x : -1, y :  0, limit : 8 }
          ]
        },
        N : {
          vectors : [
            { x :  1, y :  2, limit : 1 },
            { x :  2, y :  1, limit : 1 },
            { x :  2, y : -1, limit : 1 },
            { x :  1, y : -2, limit : 1 },
            { x : -1, y : -2, limit : 1 },
            { x : -2, y : -1, limit : 1 },
            { x : -2, y :  1, limit : 1 },
            { x : -1, y :  2, limit : 1 }
          ]
        },
        B : {
          vectors : [
            { x :  1, y :  1, limit : 8 },
            { x :  1, y : -1, limit : 8 },
            { x : -1, y : -1, limit : 8 },
            { x : -1, y :  1, limit : 8 }
          ]
        },
        Q : {
          vectors : [
            { x :  0, y :  1, limit : 8 },
            { x :  1, y :  0, limit : 8 },
            { x :  0, y : -1, limit : 8 },
            { x : -1, y :  0, limit : 8 },
          
            { x :  1, y :  1, limit : 8 },
            { x :  1, y : -1, limit : 8 },
            { x : -1, y : -1, limit : 8 },
            { x : -1, y :  1, limit : 8 }
          ]
        },
        K : {
          vectors : [
            { x :  0, y :  1, limit : 1 },
            { x :  1, y :  0, limit : 1 },
            { x :  0, y : -1, limit : 1 },
            { x : -1, y :  0, limit : 1 },
        
            { x :  1, y :  1, limit : 1 },
            { x :  1, y : -1, limit : 1 },
            { x : -1, y : -1, limit : 1 },
            { x : -1, y :  1, limit : 1 }
          ]
        }
      }
    }
  })
})(jQuery);