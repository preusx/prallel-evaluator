'use strict';

angular.module('ParallelEval', [])
    .factory('Draggable', function() {
        var Draggable;

        return Draggable = (function() {
            function Draggable(element) {};

            // Draggable.prototype. = function() {};
        })();
    })
    .factory('ParallelEval', function() {
        var ParallelEval;

        return ParallelEval = (function() {
            function ParallelEval(element) {
                if(typeof element === 'string') {
                    element = document.getElementById(element);
                }

                this.element = angular.element(element);
                this.paper = Raphael(element, this.element.width,
                    this.element.height);
            };

            ParallelEval.prototype.redraw = function(expr) {
                this.expr = expr ? this.reversePolishNotation(expr) : this.expr;

                this.buildGraph();
                this.paper.clear();
                this.drawGraph();
            };

            ParallelEval.prototype.reversePolishNotation = function(expr) {
                /**
                 * Алгоритм Дейкстры для построения обратной польской нотации.
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

                    console.log(item, expr, priority[item]);

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
                                > priority[item] && symbols.length > 0) {
                                symbolsBuf.push(symbols.pop());
                            }

                            symbols.push(item);

                            while(symbolsBuf.length > 0) {
                                symbols.push(symbolsBuf.pop());
                            }
                        }
                    } else {
                        sequence.push(parseFloat(item));
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
                };

                while(bottom++ < expr.length-1) {
                    item = new Node(expr[bottom]);

                    if(isOperator(expr[bottom])) {
                        item.left = expr.pop();
                        item.right = expr.pop();
                    }

                    expr.push(item);
                }

                this.graph = {
                    root: expr[bottom],
                    depth: (function getDepth(node) {
                        // Рекурсивно считаем глубину графа.
                        return node !== null ? 1 + Math.max(getDepth(node.left),
                            getDepth(node.right)) : 0;
                    })(expr[bottom])
                };
            };

            // ParallelEval.prototype. = function() {};

            return ParallelEval;
        })();
    })
    .controller('ParallelEvalCtrl', function($scope, ParallelEval) {
        this.parallelEval = new ParallelEval('canvas');
    })
    .directive('parallelEval', function() {
        var directiveObject;

        return directiveObject = {
            restrict: 'A',
            controller: 'ParallelEvalCtrl'
        };
    });