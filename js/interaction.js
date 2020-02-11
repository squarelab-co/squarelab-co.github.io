

document.documentElement.className = 'js';
let supportsCssVars = function () {
    let s = document.createElement('style'),
        support;

    s.innerHTML = "root: { --tmp-var: bold; }";
    document.head.appendChild(s);
    support = !!(window.CSS && window.CSS.supports && window.CSS.supports('font-weight', 'var(--tmp-var)'));
    s.parentNode.removeChild(s);
    return support;
}
if (!supportsCssVars()) alert('Please view this demo in a modern browser that supports CSS Variables.')

//Stellar
$(function(){
    $.stellar({
        horizontalScrolling: false,
        verticalOffset: 150
    });
});


//Scroll Magic
window.onload = function () { // 윈도우 로드를 기다리는 구문
    // Init ScrollMagic
    let controller = new ScrollMagic.Controller({
        refreshInterval: 0
    });

    // Logo
    new ScrollMagic.Scene({
        triggerElement: '#playwings',
        triggerHook: 0.05
    })
        .setTween(TweenMax.to('#header', 0.0001, {backgroundColor: '#fff'}))
        .setClassToggle('.bi-b', 'bi-bb')
        .addTo(controller);

    // Hiring
    new ScrollMagic.Scene({
        triggerElement: '#footer',
        triggerHook: 1
    })
        .setTween(TweenMax.to('#hiring', 0.2, {autoAlpha:0}))
        .addTo(controller);

    // Image Fade In Up
   

    $('.info-img').each(function(){

        new ScrollMagic.Scene({
            triggerElement: this,
            triggerHook: 0.7
        })
            .setClassToggle(this.children[1], 'fade-in')
            .addIndicators()
            .addTo(controller);
    });

    $('.info-img').each(function(){

        new ScrollMagic.Scene({
            triggerElement: this,
            triggerHook: 0.5
        })
            .setClassToggle(this.children[0], 'fade-in-2')
            .addIndicators()
            .addTo(controller);
    });

    


    imagesLoaded(document.body, () => {
        anime.remove(DOM.svg);
        anime({
            targets: DOM.svg,
            duration: 1,
            easing: 'linear',
            scaleX: shapes[0].scaleX,
            scaleY: shapes[0].scaleY,
            translateX: shapes[0].tx + 'px',
            translateY: shapes[0].ty + 'px',
            rotate: shapes[0].rotate + 'deg'
        });

        let step;
        DOM.contentElems.forEach((el, pos) => {
            const scrollElemToWatch = pos ? DOM.contentElems[pos] : DOM.contentElems;
            pos = pos ? pos : contentElemsTotal;
            const watcher = scrollMonitor.create(scrollElemToWatch, -350);

            watcher.enterViewport(function () {
                step = pos;
                anime.remove(DOM.shapeEl);
                anime({
                    targets: DOM.shapeEl,
                    duration: shapes[pos].animation.points.duration,
                    easing: shapes[pos].animation.points.easing,
                    elasticity: shapes[pos].animation.points.elasticity || 0,
                    points: shapes[pos].points,
                    fill: {
                        value: shapes[pos].fill.color,
                        duration: shapes[pos].fill.duration,
                        easing: shapes[pos].fill.easing
                    }
                });

                anime.remove(DOM.svg);
                anime({
                    targets: DOM.svg,
                    duration: shapes[pos].animation.svg.duration,
                    easing: shapes[pos].animation.svg.easing,
                    elasticity: shapes[pos].animation.svg.elasticity || 0,
                    scaleX: shapes[pos].scaleX,
                    scaleY: shapes[pos].scaleY,
                    translateX: shapes[pos].tx + 'px',
                    translateY: shapes[pos].ty + 'px',
                    rotate: shapes[pos].rotate + 'deg'
                });
            });

            watcher.exitViewport(function () {
                const idx = !watcher.isAboveViewport ? pos - 1 : pos + 1;

                if (idx <= contentElemsTotal && step !== idx) {
                    step = idx;
                    anime.remove(DOM.shapeEl);
                    anime({
                        targets: DOM.shapeEl,
                        duration: shapes[idx].animation.points.duration,
                        easing: shapes[idx].animation.points.easing,
                        elasticity: shapes[idx].animation.points.elasticity || 0,
                        points: shapes[idx].points,
                        fill: {
                            value: shapes[idx].fill.color,
                            duration: shapes[idx].fill.duration,
                            easing: shapes[idx].fill.easing
                        }
                    });

                    anime.remove(DOM.svg);
                    anime({
                        targets: DOM.svg,
                        duration: shapes[idx].animation.svg.duration,
                        easing: shapes[idx].animation.svg.easing,
                        elasticity: shapes[idx].animation.svg.elasticity || 0,
                        scaleX: shapes[idx].scaleX,
                        scaleY: shapes[idx].scaleY,
                        translateX: shapes[idx].tx + 'px',
                        translateY: shapes[idx].ty + 'px',
                        rotate: shapes[idx].rotate + 'deg'
                    });
                }
            });
        });

        Array.from(document.querySelectorAll('.content--layout')).forEach(el => new TiltObj(el));
        // Remove loading class from body
        document.body.classList.remove('loading');
    });
}

const extend = function (a, b) {
    for (let key in b) {
        if (b.hasOwnProperty(key)) {
            a[key] = b[key];
        }
    }
    return a;
};

// from http://www.quirksmode.org/js/events_properties.html#position
const getMousePos = function (ev) {
    let posx = 0;
    let posy = 0;
    if (!ev) ev = window.event;
    if (ev.pageX || ev.pageY) {
        posx = ev.pageX;
        posy = ev.pageY;
    } else if (ev.clientX || ev.clientY) {
        posx = ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        posy = ev.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    return {x: posx, y: posy};
};

const TiltObj = function (el, options) {
    this.el = el;
    this.options = extend({}, this.options);
    extend(this.options, options);
    this.DOM = {};
    this.DOM.img = this.el.querySelector('.content__img');
    this.DOM.title = this.el.querySelector('.content__title');
    this._initEvents();
}

TiltObj.prototype.options = {
    movement: {
        img: {translation: {x: -30, y: -30}},
        title: {translation: {x: 20, y: 20}},
    }
};

TiltObj.prototype._initEvents = function () {
    this.mouseenterFn = (ev) => {
        anime.remove(this.DOM.img);
        anime.remove(this.DOM.title);
    };

    this.mousemoveFn = (ev) => {
        requestAnimationFrame(() => this._layout(ev));
    };

    this.mouseleaveFn = (ev) => {
        requestAnimationFrame(() => {
            anime({
                targets: [this.DOM.img, this.DOM.title],
                duration: 6000,
                easing: 'easeOutExpo',
                elasticity: 200,
                translateX: 0,
                translateY: 0
            });
        });
    };

    this.el.addEventListener('mousemove', this.mousemoveFn);
    this.el.addEventListener('mouseleave', this.mouseleaveFn);
    this.el.addEventListener('mouseenter', this.mouseenterFn);
};

TiltObj.prototype._layout = function (ev) {
    // Mouse position relative to the document.
    const mousepos = getMousePos(ev);
    // Document scrolls.
    const docScrolls = {
        left: document.body.scrollLeft + document.documentElement.scrollLeft,
        top: document.body.scrollTop + document.documentElement.scrollTop
    };
    const bounds = this.el.getBoundingClientRect();
    // Mouse position relative to the main element (this.DOM.el).
    const relmousepos = {
        x: mousepos.x - bounds.left - docScrolls.left,
        y: mousepos.y - bounds.top - docScrolls.top
    };

    // Movement settings for the animatable elements.
    const t = {
        img: this.options.movement.img.translation,
        title: this.options.movement.title.translation,
    };

    const transforms = {
        img: {
            x: (-0.5 * t.img.x - t.img.x) / bounds.width * relmousepos.x + t.img.x,
            y: (-0.5 * t.img.y - t.img.y) / bounds.height * relmousepos.y + t.img.y
        },
        title: {
            x: (-0.5 * t.title.x - t.title.x) / bounds.width * relmousepos.x + t.title.x,
            y: (-0.5 * t.title.y - t.title.y) / bounds.height * relmousepos.y + t.title.y
        }
    };
    this.DOM.img.style.WebkitTransform = this.DOM.img.style.transform = 'translateX(' + transforms.img.x + 'px) translateY(' + transforms.img.y + 'px)';
    this.DOM.title.style.WebkitTransform = this.DOM.title.style.transform = 'translateX(' + transforms.title.x + 'px) translateY(' + transforms.title.y + 'px)';
};

const DOM = {};
DOM.svg = document.querySelector('.morph');
DOM.shapeEl = DOM.svg.querySelector('polygon');
DOM.contentElems = Array.from(document.querySelectorAll('.content-wrap'));
DOM.contentLinks = Array.from(document.querySelectorAll('.content__link'));
DOM.footer = document.querySelector('.content--related');
const contentElemsTotal = DOM.contentElems.length;
const shapes = [
    {
        points: '983.4,101.6 983.4,668.4 416.6,668.4 416.6,101.9 416.6,101.9 416.6,101.9', //네모
        scaleX: .9,
        scaleY: .9,
        rotate: 0,
        tx: 0,
        ty: 0,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    },
    {
        points: '890.9,54.3 1081.8,385 890.9,715.7 509.1,715.7 318.2,385 509.1,54.3', //육각
        scaleX: .9,
        scaleY: .9,
        rotate: 0,
        tx: 0,
        ty: 0,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    },
    {
        points: '700,84.4 1047.1,685.6 352.9,685.6 352.9,685.6 352.9,685.6 352.9,685.6', //세모
        scaleX: .9,
        scaleY: .9,
        rotate: 0,
        tx: 0,
        ty: 0,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    },
    {
        points: '358.01 0 736.02 267.38 595.46 700 140.57 700 10 267.38 358.01 0', //오각
        scaleX: 1,
        scaleY: 1,
        rotate: 90,
        tx: 0,
        ty: 300,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    },
    {
        points: '983.4,101.6 983.4,668.4 416.6,668.4 416.6,101.9 416.6,101.9 416.6,101.9', //네모
        scaleX: 1.1,
        scaleY: 1.1,
        rotate: 0,
        tx: 0,
        ty: 0,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    },
    {
        points: '983.4,101.6 983.4,668.4 416.6,668.4 416.6,101.9 416.6,101.9 416.6,101.9', //네모
        scaleX: 1.1,
        scaleY: 1.1,
        rotate: 0,
        tx: 0,
        ty: 0,
        fill: {
            color: 'none',
            duration: 800,
            easing: 'linear'
        },
        animation: {
            points: {
                duration: 800,
                easing: 'easeOutExpo'
            },
            svg: {
                duration: 800,
                easing: 'easeOutExpo'
            }
        }
    }
];