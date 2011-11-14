/*
 * jChess 0.1.0 - Chess Library Built From jQuery
 *
 * Copyright (c) 2008 Ben Marini
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// If Firebug is not installed, prevent console.log() from creating error messages
if (typeof console == "undefined") { var console = { log: function() {} }; }

// Iterate within an arbitrary context...
jQuery.eachWithContext = function(context, object, callback) {
  for ( var i = 0, length = object.length, value = object[0];
    i < length && callback.call(context, i, value ) !== false; value = object[++i] ) {}
};

(function($) {
  /* Constructor */
  $.chess = function(options, wrapper) {
    this.settings = $.extend( {}, $.chess.defaults, options );
    this.wrapper  = wrapper;

    this.game     = {
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
      raw_annotations : [],

      next_piece_id : 64,
      transitions : [],
      board_direction : 1
    };

  };

  /* Add chess() to the jQuery namespace */
  $.fn.chess = function(options) {
    var chess = new $.chess(options, this[0]);
    chess.init();
    return chess;
  };

  $.extend($.chess, {

    defaults : {
      fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      square_size : 43,
      offsets : { left: 0, top: 0},
      board_element_selector : '.chess-board',
      json_annotations : false
    },

    prototype : {
      init : function() {
        // Load a fresh board position
        this.setUpBoard( this.parseFEN( this.settings.fen ) );

        // If pgn was passed in, parse it
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
          });
        });

        return board;
      },

      writeBoard : function() {
        if (this.boardElement().size() == 0) {
          $(this.wrapper).append('<div class="chess-board"></div>');
        }

        $.eachWithContext(this, this.boardData(), function(j, row) {
          $.eachWithContext(this, row, function(k, val) {
            var piece = this.boardData()[j][k];
            var square = this.coord2Algebraic(j,k);

            if (piece != '-') this.addDomPiece(piece.id, piece.piece, square);
          });
        });
      },

      getDomPieceId : function(id) {
        return this.wrapper.id + "_piece_" + id;
      },

      addDomPiece : function(id, piece, algebraic) {
        var square   = this.algebraic2Coord(algebraic);
        if (this.game.board_direction < 0) {
          square[0] = 7 - square[0];
          square[1] = 7 - square[1];
        }

        var pos_top  = this.settings.square_size * square[0] + this.settings.offsets.top;
        var pos_left = this.settings.square_size * square[1] + this.settings.offsets.left;

        var color = 'b';
        if (piece.toUpperCase() == piece) { color = 'w'; }

        this.boardElement().append('<div id="' + this.getDomPieceId(id) + '" class="' + color + piece + '"></div>');
        $('#' + this.getDomPieceId(id)).css({ position: 'absolute', top:pos_top, left:pos_left });
      },

      moveDomPiece : function(id, move) {
        var from = this.algebraic2Coord(move.from);
        var to   = this.algebraic2Coord(move.to);

        var top  = (parseInt(to[0]) - parseInt(from[0])) * this.settings.square_size * this.game.board_direction;
        var left = (parseInt(to[1]) - parseInt(from[1])) * this.settings.square_size * this.game.board_direction;

        $('#' + this.getDomPieceId(id)).animate({
          'top' : '+=' + top + 'px', 'left' : '+=' + left + 'px'
        }, 'fast');
      },

      removeDomPiece : function(id) {
        $('#' + this.getDomPieceId(id)).remove();
      },

      transitionTo : function(halfmove_number) {
        while (halfmove_number < this.game.halfmove_number) {
          this.transitionBackward();
        }

        while (halfmove_number > this.game.halfmove_number) {
          this.transitionForward();
        }
      },

      transitionForward : function() {
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
        $.eachWithContext(this, transitions, function(i, transition) {
          var pieces          = transition.split(':');
          var transition_type = pieces[0];
          var id              = pieces[1];

          switch(transition_type) {
            case 'r':
              this.removeDomPiece(id);
              break;
            case 'm':
              this.moveDomPiece(id, { from : pieces[2], to : pieces[3] });
              break;
            case 'a':
              this.addDomPiece(id, pieces[2], pieces[3]);
              break;
          }

        });
      },

      clearBoard : function() {
        this.boardElement().empty();
      },

      flipBoard : function() {
        var board_length = this.settings.square_size * 7;
        var offsets      = this.settings.offsets;

        this.boardElement().children().each(function() {
          var top_val      = parseInt($(this).css('top')) - offsets.top;
          var left_val     = parseInt($(this).css('left')) - offsets.left;
          $(this).css('top', (board_length - top_val) + offsets.top);
          $(this).css('left', (board_length - left_val) + offsets.left);
        });

        this.game.board_direction *= -1;
      },

      parseFEN : function(fen) {
        // rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2
        var new_board     = [];
        var fen_parts     = fen.replace(/^\s*/, "").replace(/\s*$/, "").split(/\/|\s/);

        for (var j = 0;j < 8; j++) {
          new_board[j] = [];
          var row = fen_parts[j].replace(/\d/g, this.replaceNumberWithDashes);
          for (var k=0;k<8;k++) {
            new_board[j][k] = row.substr(k, 1);
          }
        }
        return new_board;
      },

      validateFEN : function(fen) {
        var pattern = /\s*([rnbqkpRNBQKP12345678]+\/){7}([rnbqkpRNBQKP12345678]+)\s[bw-]\s(([kqKQ]{1,4})|(-))\s(([a-h][1-8])|(-))\s\d+\s\d+\s*/;
        return pattern.test(fen);
      },

      parsePGN : function(pgn) {
        // Do a little clean up on the string
        pgn = $.trim(pgn).replace(/\n|\r/g, ' ').replace(/\s+/g, ' ');
        var instance = this;
        // Recognize escaped closing curly brackets as part of the comment
        // This allows us to have json encoded comments
        pgn = pgn.replace(/\{((\\})|([^}]))+}/g, function(){ return instance.pluckAnnotation.apply(instance, arguments); });

        var headers = ['Event','Site','Date','Round','White','Black','Result'];
        for (var i=0; i < headers.length; i++) {
          var re      = new RegExp(headers[i] + ' "([^"]*)"]');
          var result  = re.exec(pgn);
          this.game.header[headers[i]] = (result == null) ? "" : result[1];
        }

        // Find the body
        this.game.body = /(1\. ?(N[acfh]3|[abcdefgh][34]).*)/m.exec(pgn)[1];

        // Remove numbers, remove result
        this.game.body = this.game.body.replace(new RegExp("1-0|1/2-1/2|0-1"), '');
        this.game.body = this.game.body.replace(/^\d+\.+/, '');
        this.game.body = this.game.body.replace(/\s\d+\.+/g, ' ');

        var moves = $.trim(this.game.body).split(/\s+/);
        // console.log(moves);

        // This must be a separate variable from i, since annotations don't
        // count as moves.
        var move_number = 0;
        $.eachWithContext(this, moves, function(i, move) {
          if ( /annotation-\d+/.test(move) ) {
            this.game.annotations[move_number] = this.game.raw_annotations.shift();
            return;
          }

          this.game.moves[move_number] = move;

          // console.log("Processing move: " + move_number + '.' + move);
          var player = (move_number % 2 == 0) ? 'w' : 'b';

          // If the move was to castle
          if ( this.patterns.castle_queenside.test(move) ) {
            var rank = (player == 'w') ? 1 : 8;
            this.movePiece(move_number, {from : "e" + rank, to : "c" + rank} );
            this.movePiece(move_number, {from : "a" + rank, to : "d" + rank} );

          } else if ( this.patterns.castle_kingside.test(move) ) {
            var rank = (player == 'w') ? 1 : 8;
            this.movePiece(move_number, {from : "e" + rank, to : "g" + rank} );
            this.movePiece(move_number, {from : "h" + rank, to : "f" + rank} );

          // If the move was a piece
          } else if ( this.patterns.piece_move.test(move) ) {
            var m = this.patterns.piece_move.exec(move);
            var piece = m[0];
            var src_file = null;
            var src_rank = null;
            var dst_file = null;
            var dst_rank = null;

            if ( this.patterns.rank_and_file_given.test(move) ) {
              var m = this.patterns.rank_and_file_given.exec(move);
              src_file = m[2];
              src_rank = m[3];
              dst_file = m[4];
              dst_rank = m[5];
            } else if ( this.patterns.file_given.test(move) ) {
              var m = this.patterns.file_given.exec(move);
              src_file = m[2];
              dst_file = m[3];
              dst_rank = m[4];
            } else if ( this.patterns.rank_given.test(move) ) {
              var m = this.patterns.rank_given.exec(move);
              src_rank = m[2];
              dst_file = m[3];
              dst_rank = m[4];
            } else if ( this.patterns.nothing_given.test(move) ) {
              var m = this.patterns.nothing_given.exec(move);
              dst_file = m[2];
              dst_rank = m[3];
            }

            var src = this.findMoveSource(piece, src_file, src_rank, dst_file, dst_rank, player);
            this.movePiece(move_number, {from : src, to : dst_file + dst_rank} );

            // If the move was a pawn
          } else {
            var dst_file = null;
            var dst_rank = null;

            if ( this.patterns.pawn_move.test(move) ) {
              var m    = this.patterns.pawn_move.exec(move);
              dst_file = m[1];
              dst_rank = m[2];
              var src  = this.findPawnMoveSource(dst_file, dst_rank, player);
              var dst  = dst_file + dst_rank;
              this.movePiece(move_number, {from : src, to : dst} );

              // Pawn capture
            } else if ( this.patterns.pawn_capture.test(move) ) {
              var m        = this.patterns.pawn_capture.exec(move);
              dst_file     = m[2];
              dst_rank     = m[3];
              var src_file = m[1];
              var src_rank = parseInt(dst_rank) + ( (player == 'w') ? -1 : 1 );

              // En passant
              var result = this.pieceAt(dst_file + dst_rank);
              if (result == '-') this.removePiece(move_number, dst_file + src_rank);
              this.movePiece(move_number, {from : src_file + src_rank, to : dst_file + dst_rank });
            }

            // Queening
            if ( this.patterns.pawn_queen.test(move) ) {
              this.removePiece(move_number, dst_file + dst_rank);

              var m = this.patterns.pawn_queen.exec(move);
              var queening_piece = m[1];
              queening_piece = (player == 'w') ? queening_piece : queening_piece.toLowerCase();
              this.addPiece(move_number, queening_piece, dst_file + dst_rank);
            }
          }

          move_number++;
        });
      },

      // src_square = square the piece is currently on
      // dst_square = square the piece will move to
      cantMoveFromAbsolutePin : function(piece, src_square, dst_square) {
        // Look for an open vector from piece to the king.
        var piece_char = piece.piece;
        var player     = ( piece_char == piece_char.toLowerCase() ) ? 'b' : 'w';

        var result = this.findAbsolutePin(player, this.pieces['R'].vectors, src_square, ['R','Q']);
        if (result == null) result = this.findAbsolutePin(player, this.pieces['B'].vectors, src_square, ['B','Q']);

        if (result != null) {
          var vector = result[0];
          var kings_square = result[1];
          var pinning_pieces_square = result[2];
          if (!this.inSquaresArray(dst_square, this.squaresBetweenEndPoints(kings_square, pinning_pieces_square))) {
            return true;
          }
        }

        return false;
      },

      inSquaresArray : function(square, squares) {
        for (var i=0; i < squares.length; i++) {
          if (squares[i] == square) return true;
        };

        return false;
      },

      squaresBetweenEndPoints : function(s,e) {
        var start   = this.algebraic2Coord(s);
        var end     = this.algebraic2Coord(e);
        var tmp     = start;
        var squares = [];
        squares.push(this.coord2Algebraic(start[0],start[1]));

        while (tmp[0] != end[0] || tmp[1] != end[1]) {
          if (tmp[0] < end[0]) tmp[0] += 1;
          if (tmp[0] > end[0]) tmp[0] -= 1;
          if (tmp[1] < end[1]) tmp[1] += 1;
          if (tmp[1] > end[1]) tmp[1] -= 1;
          squares.push(this.coord2Algebraic(tmp[0],tmp[1]));
        }

        return squares;
      },

      findAbsolutePin : function(player, vectors, src_square, pieces_that_can_pin_on_this_vector) {
        // Look at vectors
        var result = this.findVectorToKing(player, vectors, src_square);
        if (result != null) {
          var vector       = result[0];
          var kings_square = result[1];

          // Find the first piece in opposite direction
          var flipped_vector = this.flipVector(vector);
          var result = this.firstPieceFromSourceAndVector(src_square, flipped_vector, flipped_vector.limit);
          if (result != null) {
            var pinning_pieces_square = result[1];
            for (var i=0; i < pieces_that_can_pin_on_this_vector.length; i++) {
              var pinning_piece = (player == 'w') ?
                pieces_that_can_pin_on_this_vector[i].toLowerCase() :
                pieces_that_can_pin_on_this_vector[i].toUpperCase();

              if (result[0].piece == pinning_piece) {
                return [vector, kings_square, pinning_pieces_square];
              }
            };
          }
        }
        return null;
      },

      findVectorToKing : function(player, vectors, src_square) {
        var king = (player == 'w') ? 'K' : 'k';
        for (var i = 0; i < vectors.length; i++) {
          var vector = vectors[i];
          var result = this.firstPieceFromSourceAndVector(src_square, vector, vector.limit);
          if (result != null && result[0].piece == king) return [vector, result[1]];
        }
        return null;
      },

      findMoveSource : function(piece, src_file, src_rank, dst_file, dst_rank, player) {
        //console.log("Looking for move source for " + piece + " from " + dst_rank + dst_file);
        if ( src_file && src_rank ) return src_file + src_rank;

        var dst_square = dst_file + dst_rank;
        var target_piece = (player == 'w') ? piece : piece.toLowerCase();
        target_piece = target_piece.toString();

        for (var i = 0; i < this.pieces[piece].vectors.length; i++) {
          var vector = this.pieces[piece].vectors[i];

          for (var size = 1; size <= vector.limit; size++) {
            var result = this.pieceFromSourceAndVector(dst_square, vector, size);
            //console.log("Looking at " + result);
            if (result == null) break;
            if (result[0] == '-') continue;

            if (result[0].piece == target_piece) {
              // Check for absolute pin on the piece in question
              if (this.cantMoveFromAbsolutePin(result[0], result[1], dst_square)) break;

              if (src_file) {
                if (result[1].substr(0,1).toString() == src_file) {
                  return result[1];
                }
              } else if (src_rank) {
                if (result[1].substr(1,1).toString() == src_rank) {
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
        var source_coords = this.algebraic2Coord(source);
        var row = source_coords[0] - (vector.y * limit);
        var col = source_coords[1] - (vector.x * limit);

        if ( row >= 8 || row < 0 || col >= 8 || col < 0 ) return null;
        piece = [this._board[row][col], this.coord2Algebraic(row, col)];
        return piece;
      },

      firstPieceFromSourceAndVector : function(source, vector, limit) {
        for (var i=1; i <= limit; i++) {
          piece = this.pieceFromSourceAndVector(source, vector, i);
          if (piece == null) return null; // End of the board reached
          if (piece[0] == '-') continue; // Square is blank
          return piece;
        };
        return null;
     },

      pieceAt : function(algebraic) {
        var square = this.algebraic2Coord(algebraic);
        return this._board[square[0]][square[1]];
      },

      // Ex: this.movePiece({from : 'e2', to : 'e4'})
      movePiece : function(num, move) {
        // console.log("Moving a piece: (" + num + ") " + " from " + move.from + " to " + move.to);

        var from = this.algebraic2Coord(move.from);
        var to   = this.algebraic2Coord(move.to);
        var piece = this.pieceAt(move.from);

        if (this.pieceAt(move.to).piece) this.removePiece(num, move.to);

        this._board[to[0]][to[1]] = this._board[from[0]][from[1]];
        this._board[from[0]][from[1]] = '-';

        this.saveTransition({type: 'm', num : num, dom_id : piece.id, from : move.from, to : move.to});
      },

      removePiece : function(num, algebraic) {
        var piece = this.pieceAt(algebraic);

        var square = this.algebraic2Coord(algebraic);
        this._board[square[0]][square[1]] = '-';

        this.saveTransition({type: 'r', num : num, dom_id : piece.id, piece: piece.piece, from : algebraic});
      },

      addPiece : function(num, piece_char, algebraic) {

        var square = this.algebraic2Coord(algebraic);
        var id = this.getNextPieceId();
        this._board[square[0]][square[1]] = { id : id, piece : piece_char };

        this.saveTransition({type: 'a', num : num, dom_id : id, to : algebraic, piece : piece_char});
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
          this.game.transitions[num].forward  = this.game.transitions[num].forward.concat(forward);
          this.game.transitions[num].backward = backward.concat(this.game.transitions[num].backward);
        }
      },

      getNextPieceId : function() {
        return ++this.game.next_piece_id;
      },

      getMove : function(n) {
        var n = (typeof n == "undefined") ? this.game.halfmove_number : n;
        return this.game.moves[n -1];
      },

      getFormattedMove : function(n) {
        var n      = (typeof n == "undefined") ? this.game.halfmove_number : n;
        var f      = Math.ceil(n / 2.0);
        var hellip = (n % 2 == 0) ? '... ' : '';
        return f + ". " + hellip + this.getMove(n);
      },

      /* Utility Functions */
      algebraic2Coord : function(algebraic) {
        return [this.rank2Row(algebraic.substr(1, 1)), this.file2Col(algebraic.substr(0, 1))];
      },

      coord2Algebraic : function(row, col) {
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

      flipVector : function(v) {
        return { x: (v.x * -1), y : (v.y * -1), limit : v.limit };
      },

      replaceNumberWithDashes : function(str) {
        var num_spaces = parseInt(str);
        var new_str = '';
        for (var i = 0; i < num_spaces; i++) { new_str += '-'; }
        return new_str;
      },

      pluckAnnotation : function(str) {
        this.game.raw_annotations = this.game.raw_annotations || [];
        var ann_num = this.game.raw_annotations.length;
        var annot   = str.substring(1,str.length-1); // Remove curly brackets
        annot       = annot.replace(/\\\{/g, '{');
        annot       = annot.replace(/\\\}/g, '}');

        if (this.settings.json_annotations) {
          eval("annot = " + annot);
        }

        this.game.raw_annotations.push(annot);
        return "annotation-" + ann_num;
      },

      annotation : function() {
        var default_value = (this.settings.json_annotations ? [] : '');
        return this.game.annotations[this.game.halfmove_number] || default_value;
      },

      addAnnotation : function(annot) {
        var current_annotations = this.annotation();
        if (typeof current_annotations == "string") {
          current_annotations += ", " + annot;
        } else {
          current_annotations.push(annot);
        }

        this.game.annotations[this.game.halfmove_number] = current_annotations;
      },

      debugBoard : function() {
        $.eachWithContext(this, this.boardData(), function(j, row) {
          $.eachWithContext(this, row, function(k, val) {
            console.log('[' + j + ',' + k + '] = { id: ' + this.boardData()[j][k].id + ', piece: ' + this.boardData()[j][k].piece + ' }');
          });
        });
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
        pawn_queen          : /=([BNQR])/
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
  });
})(jQuery);
