'use strict';

function factor(a) {
    return a > 0 ? a + factor(a-1) : 1;
}

angular.module('ParallelEval', [])
    .factory('Draggable', function($document) {
        var Draggable;

        return Draggable = (function() {
            function Draggable(element) {
                var self = this;
                this.element = angular.element(element);
                this.handler = {
                    mousedown: function(e){self.mousedown(e);},
                    mousemove: function(e){self.mousemove(e);},
                    mouseup: function(e){self.mouseup(e);}
                };

                this.element.on('mousedown', this.handler.mousedown);
            };

            Draggable.prototype.mousedown = function(e) {
                var self = this;
                this.eOffset = {
                    x: e.x,
                    y: e.y
                };

                this.offset = {
                    x: parseInt(this.element.css('left') || 0),
                    y: parseInt(this.element.css('top') || 0)
                };

                $document.on('mousemove', this.handler.mousemove)
                    .on('mouseup', this.handler.mouseup);
            };

            Draggable.prototype.mousemove = function(e) {
                this.element.css({
                    top: this.offset.y + e.y - this.eOffset.y,
                    left: this.offset.x + e.x - this.eOffset.x
                });
            };

            Draggable.prototype.mouseup = function(e) {
                $document.off('mousemove', this.handler.mousemove)
                    .off('mouseup', this.handler.mouseup);
            };

            return Draggable;
        })();
    })
    .factory('ParallelEval', function(Draggable) {
        var ParallelEval;

        return ParallelEval = (function() {
            function ParallelEval(element) {
                if(typeof element === 'string') {
                    element = document.getElementById(element);
                }

                this.element = angular.element(element);
                this.paper = Raphael(element, 2500, 2500);
                this.draggable = new Draggable(this.paper.canvas);
                console.log(this.element);
                this.draggable.element.css({
                    top: -1 * ((2500 - this.element[0].clientHeight) / 2),
                    left: -1 * ((2500 - this.element[0].clientWidth) / 2)
                });
            };

            ParallelEval.prototype.redraw = function(expr) {
                this.expr = expr ? this.reversePolishNotation(expr) : this.expr;

                try {
                    this.buildGraph();
                    this.paper.clear();
                    this.drawGraph();
                } catch(e) {};
            };

            ParallelEval.prototype.reversePolishNotation = function(expr) {
                /**
                 * Алгоритм Дейкстры для построения обратной польской записи.
                 *
                 * Правила:
                 * Рассматриваем поочередно каждый символ:
                 * 1. Если этот символ - число (или переменная), то просто
                 * помещаем его в выходную строку.
                 * 2. Если символ - знак операции (+, -, *, /), то проверяем
                 * приоритет данной операции. Операции умножения и деления
                 * имеют наивысший приоритет (допустим он равен 3). Операции
                 * сложения и вычитания имеют меньший приоритет (равен 2).
                 * Наименьший приоритет (равен 1) имеет открывающая скобка.
                 *    Получив один из этих символов, мы должны проверить стек: 
                 *    а) Если стек все еще пуст, или находящиеся в нем символы
                 *       (а находится в нем могут только знаки операций и
                 *       открывающая скобка) имеют меньший приоритет, чем
                 *       приоритет текущего символа, то помещаем текущий символ
                 *       в стек.
                 *    б) Если символ, находящийся на вершине стека имеет
                 *       приоритет, больший или равный приоритету текущего
                 *       символа, то извлекаем символы из стека в выходную
                 *       строку до тех пор, пока выполняется это условие; затем
                 *       переходим к пункту а).
                 * 3. Если текущий символ - открывающая скобка, то помещаем ее
                 * в стек.
                 * 4. Если текущий символ - закрывающая скобка, то извлекаем
                 * символы из стека в выходную строку до тех пор, пока не
                 * встретим в стеке открывающую скобку (т.е. символ с
                 * приоритетом, равным 1), которую следует просто уничтожить.
                 * Закрывающая скобка также уничтожается.
                 *
                 */ 
                var item, sequence = [], symbols = [], symbolsBuf = [];
                var priority = {
                    '+': 2, '-': 2, '*': 3, '/': 3, '^': 3, '(': 1, ')': 1
                };
                var re = /([0-9.]+|[\+\-\*\^\/\(\)])/;

                expr = expr.replace(/\s/gim, '');

                while(expr.length > 0) {
                    item = expr.match(re)[0];
                    expr = expr.replace(re, '');

                    if(priority[item] > 0) {
                        if(['(', ')'].indexOf(item) >= 0) {
                            if(item === ')') {
                                while((item = symbols.pop()) !== '('
                                    && symbols.length > 0) {
                                    sequence.push(item);
                                }
                                // while(symbolsBuf.length > 0) {
                                //     sequence.push(symbolsBuf.pop());
                                // }
                            } else {
                                symbols.push(item);
                            }
                        } else {
                            while(priority[symbols[symbols.length-1]]
                                >= priority[item] && symbols.length > 0) {
                                sequence.push(symbols.pop());
                            }
;
                            symbols.push(item);

                            // while(symbolsBuf.length > 0) {
                            //     symbols.push(symbolsBuf.pop());
                            // }
                        }
                    } else {
                        sequence.push(item);
                        // sequence.push(parseFloat(item));
                    }
                }

                while(symbols.length > 0) {
                    sequence.push(symbols.pop());
                }

                return sequence;
            };
            
            ParallelEval.prototype.buildGraph = function() {
                /**
                 * Строим граф выражения.
                 * 
                 * Построение графа сводится к решению обратной польской записи.
                 * Только вместо применения операторов к числам, мы создаем
                 * узел графа исходя из таких соображений:
                 * - В случае если текущий элемент цифра - создаем узел и
                 *   забрасываем его в конец последовательности.
                 * - Если тек. э-лт оператор - создаем узел, и присваиваем его
                 *   правому и левому ребенку извлекаемые из поледовательности
                 *   верхние два элемента. И забрасываем узел в конец
                 *   последовательности.
                 * - Делаем это, пока последовательность не будет состоять из
                 *   одного элемента - это наш корень графа.
                 *
                 */
                var expr = JSON.parse(JSON.stringify(this.expr)),
                    depth = 0, bottom = -1, item;

                var isOperator = function(item) {
                    return ['+', '-', '/', '*', '^'].indexOf(item) >= 0;
                };
                var Node = function(item) {
                    this.type = isOperator(item) ? 'operator' : 'number';
                    this.left = null;
                    this.right = null;
                    this.value = item;
                    this.children = {
                        left: 0,
                        right: 0
                    }
                };

                while(++bottom < expr.length-1) {
                    if(typeof expr[bottom] === 'string') {
                        item = new Node(expr[bottom]);
                    } else {
                        item = expr[bottom];
                    }

                    if(isOperator(expr[bottom])) {
                        item.left = expr.pop();
                        item.right = expr.pop();
                    }

                    expr.push(item);
                }

                item = expr[bottom] || null;
                this.graph = {
                    root: item,
                    depth: (function getDepth(node) {
                        // Рекурсивно считаем глубину графа.

                        if(node !== null) {
                            node.children.left = getDepth(node.left);
                            node.children.right = getDepth(node.right);

                            return 1 + Math.max(node.children.left,
                                node.children.right)
                        }

                        return 0;
                    })(item)
                };
            };

            ParallelEval.prototype.drawGraph = function() {
                var self = this,
                    size = {
                        operator: 14,
                        number: 20,
                        distance: 12,
                        font: 18
                    },
                    color = {
                        operator: '#187abf',
                        number: '#187abf',
                        path: '#187abf',
                        text: '#fff'
                    },
                    start = {
                        x: this.paper.width / 2,
                        y: this.paper.height / 2 +
                            (this.graph.depth * size.distance)
                    };

                var drawNode = function(x, y, node) {
                    var textOffset = parseInt(node.value.length/3*size.font);

                    self.paper.circle(x, y, size[node.type]).attr({
                        'fill': color[node.type],
                        'stroke-width': 0
                    });
                    self.paper.text(x+((size[node.type]-textOffset) / 7),
                        y+((size[node.type]-size.font) / 7), node.value).attr({
                        'fill': color.text,
                        'font-size': size.font,
                        'font-weight': 600,
                        'font-family': 'GostA'
                    });
                };
                // var drawNumber = function(x, y) {};

                drawNode(start.x, start.y, this.graph.root);

                if(this.graph && this.graph.root !== null) {
                    (function draw(node, pos) {
                        if(node !== null) {
                            var x, y = pos.y - size.distance * 4;

                            if(node.left !== null) {
                                x = pos.x - (Math.pow(2, node.children.right)
                                    * size.distance);

                                drawNode(x, y, node.left);
                                self.paper.path("M"+pos.x.toString()+" "
                                    +pos.y.toString()+" L"+x.toString()
                                    +" "+y.toString()).attr({
                                        'stroke': '#fff',
                                        'stroke-width': 2
                                    }).toBack();
                                draw(node.left, {x:x, y:y});
                            }
                            if(node.left !== null) {
                                x = pos.x + (Math.pow(2, node.children.left)
                                    * size.distance);

                                drawNode(x, y, node.right);
                                self.paper.path("M"+pos.x.toString()+" "
                                    +pos.y.toString()+" L"+x.toString()
                                    +" "+y.toString()).attr({
                                        'stroke': '#fff',
                                        'stroke-width': 2
                                    }).toBack();
                                draw(node.right, {x:x, y:y});
                            }
                        }
                    })(this.graph.root, start);
                }
            };

            return ParallelEval;
        })();
    })
    .controller('ParallelEvalCtrl', function($scope, ParallelEval) {
        self = this;
        self.parallelEval = new ParallelEval('canvas');
        self.redraw = function(e) {
            if(e) {
                e.preventDefault();
            }

            self.parallelEval.redraw(self.expression);
        };
        self.expression = "";
        $scope.controller = self;
    })
    .directive('parallelEval', function() {
        var directiveObject;

        return directiveObject = {
            restrict: 'A',
            controller: 'ParallelEvalCtrl',
            link: function($scope) {
                $scope.controller.expression = "(110*20+40)+(45+34)*5+18/3*25";
                $scope.controller.redraw();
            }
        };
    });