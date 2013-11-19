'use strict';

angular.module('ParallelEval', [])
    .factory('Draggable', function($document) {
        var Draggable;

        return Draggable = (function() {
            function Draggable(element, parent) {
                var self = this;
                this.element = angular.element(element);
                this.parent = parent;
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
                var top = this.offset.y + e.y - this.eOffset.y,
                    left = this.offset.x + e.x - this.eOffset.x,
                    size = {
                        x: this.element[0].clientWidth
                            - this.parent[0].clientWidth,
                        y: this.element[0].clientHeight
                            - this.parent[0].clientHeight
                    };
                this.element.css({
                    top: top > 0 ? 0 :
                        (-1 * top > size.y ? -1 * size.y : top),
                    left: left > 0 ? 0 :
                        (-1 * left > size.x ? -1 * size.x : left)
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
                this.paper = Raphael(element, 4500, 2500);
                this.draggable = new Draggable(this.paper.canvas, this.element);
                this.draggable.element.css({
                    top: -1 * ((2500 - this.element[0].clientHeight) / 2),
                    left: -1 * ((4500 - this.element[0].clientWidth) / 2)
                });

                this.graph = {};
                this.mainframes = [1000000, 2, 3, 4];
                this.data = {};
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
                    '+': 2, '-': 2, '*': 3, '/': 3, '^': 4, '(': 1, ')': 1
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
                        }
                    } else {
                        sequence.push(item);
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

                    this.ready = this.type === 'number' ? 2 : 0;
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
                this.graph.root = item;
                this.graph.depth = (function getDepth(node, depth) {
                    // Рекурсивно считаем глубину графа.

                    if(node !== null) {
                        node.depth = ++depth;
                        node.children.left = getDepth(node.left);
                        node.children.right = getDepth(node.right);

                        return 1 + Math.max(node.children.left,
                            node.children.right)
                    }

                    return 0;
                })(item, 0);
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
                        path: '#fff',
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
                var drawPath = function(fx, fy, x, y) {
                    self.paper.path("M"+fx.toString()+" "
                        +fy.toString()+" L"+x.toString()
                        +" "+y.toString()).attr({
                            'stroke': color.path,
                            'stroke-width': 2
                        }).toBack();
                };

                drawNode(start.x, start.y, this.graph.root);

                if(this.graph && this.graph.root !== null) {
                    (function draw(node, pos) {
                        if(node !== null) {
                            var x, y = pos.y - size.distance * 4;

                            if(node.left !== null) {
                                x = pos.x - (Math.pow(2, node.children.right)
                                    * size.distance);

                                drawNode(x, y, node.left);
                                drawPath(pos.x, pos.y, x, y);
                                draw(node.left, {x:x, y:y});
                            }
                            if(node.right !== null) {
                                x = pos.x + (Math.pow(2, node.children.left)
                                    * size.distance);

                                drawNode(x, y, node.right);
                                drawPath(pos.x, pos.y, x, y);
                                draw(node.right, {x:x, y:y});
                            }
                        }
                    })(this.graph.root, start);
                }
            };

            ParallelEval.prototype.calculateData = function() {
                /**
                 *   Ускорение
                 *    S_p = T_1 / T_p
                 *   Эффективность
                 *    E_p = S_p/p
                 *   p - количество процессоров
                 *   T - количество тактов.
                 */

                var item, nodes = [], bottom = -1, i, t = 0;

                nodes.push(this.graph.root);
                while(++bottom < nodes.length) {
                    item = nodes[bottom];

                    if(item.left.type === 'operator') {
                        nodes.push(item.left);
                    }
                    if(item.right.type === 'operator') {
                        nodes.push(item.right);
                    }

                    t += item.type === 'operator';
                }

                this.data[1] = {
                    p: 1,
                    t: t,
                    s: 1,
                    e: 1
                };

                this.nodes = nodes;

                for(i = 0; i < this.mainframes.length; i++) {
                    var p = this.mainframes[i];
                    this.data[p] = {
                        p: p,
                        t: this.calculateMainframeTicks(p)
                    };

                    this.data[p].s = this.data[1].t / this.data[p].t;
                    this.data[p].e = this.data[p].s / p;
                }
            };

            ParallelEval.prototype.calculateMainframeTicks =
                function(processorsCount) {
                var count = 0, item;
                var nodes = (function(a) {
                    var nodes = [];
                    for(var i = 0; i < a.length; i++) {
                        a[i].ready = 0;
                        nodes.push(a[i]);
                    }
                    return nodes;
                })(this.nodes);

                while(nodes.length > 0) {
                    item = nodes.shift();
                    item.ready = (item.left.ready===2)+(item.right.ready===2);

                    if(item.ready !== 2){
                        nodes.push(item);
                        // count += processorsCount;
                    } else {
                        count++;
                    }
                }

                return parseInt(count / processorsCount);
            };

            return ParallelEval;
        })();
    })
    .controller('ParallelEvalCtrl', function($scope, ParallelEval) {
        self = this;
        self.parallelEval = new ParallelEval('canvas');
        self.rebuild = function(e) {
            if(e) {
                e.preventDefault();
            }

            self.parallelEval.redraw(self.expression);
            self.parallelEval.calculateData();
            self.data = self.parallelEval.data;
        };
        self.data = [];
        self.expression = "";
        $scope.controller = self;
    })
    .directive('parallelEval', function() {
        var directiveObject;

        return directiveObject = {
            restrict: 'A',
            controller: 'ParallelEvalCtrl',
            link: function($scope) {
                $scope.controller.expression =
                    "(110*20+(40-8.5))+(45+34)*(5+10)+18/3*(25*3)";
                $scope.controller.rebuild();
            }
        };
    });