var header = jQuery(".main_header"),
  html = jQuery("html"),
  body = jQuery("body"),
  footer = jQuery("footer"),
  window_h = jQuery(window).height(),
  window_w = jQuery(window).width(),
  main_wrapper = jQuery(".main_wrapper"),
  site_wrapper = jQuery(".site_wrapper"),
  preloader_block = jQuery(".preloader"),
  fullscreen_block = jQuery(".fullscreen_block"),
  is_masonry = jQuery(".is_masonry"),
  grid_portfolio_item = jQuery(".grid-portfolio-item"),
  pp_block = jQuery(".pp_block"),
  head_border = 1;
jQuery(document).ready(function(t) {
  "use strict";
  jQuery(".preloader").size() > 0 && (setTimeout("preloader_block.addClass('la-animate');", 500), setTimeout("preloader_block.addClass('load_done')", 2500), t(window).bind("load", function() { setTimeout("preloader_block.remove()", 2500) })), t("html").hasClass("sticky_menu") && body.hasClass("admin-bar") && header.css("top", jQuery("#wpadminbar").height()), content_update(), jQuery(".flickr_widget_wrapper").size() > 0 && jQuery(".flickr_badge_image a").each(function() { jQuery(this).append('<div class="flickr_fadder"></div>') }), header.find(".header_wrapper").append('<a href="javascript:void(0)" class="menu_toggler"></a>'), header.append('<div class="mobile_menu_wrapper"><ul class="mobile_menu container"/></div>'), jQuery(".mobile_menu").html(header.find(".menu").html()), jQuery(".mobile_menu_wrapper").hide(), jQuery(".menu_toggler").click(function() { jQuery(".mobile_menu_wrapper").slideToggle(300), jQuery(".main_header").toggleClass("opened") }), setTimeout("jQuery('body').animate({'opacity' : '1'}, 500)", 500), jQuery(".search_toggler").click(function(t) { t.preventDefault(), header.toggleClass("search_on") }), pp_block.size() && centerWindow404(), jQuery("a[data-rel]").each(function() { t(this).attr("rel", t(this).data("rel")) }), jQuery(".nivoSlider").each(function() { jQuery(this).nivoSlider({ directionNav: !1, controlNav: !0, effect: "fade", pauseTime: 4e3, slices: 1 }) }), jQuery(".shortcode_accordion_item_title").click(function() { jQuery(this).hasClass("state-active") || (jQuery(this).parents(".shortcode_accordion_shortcode").find(".shortcode_accordion_item_body").slideUp("fast", function() { content_update() }), jQuery(this).next().slideToggle("fast", function() { content_update() }), jQuery(this).parents(".shortcode_accordion_shortcode").find(".state-active").removeClass("state-active"), jQuery(this).addClass("state-active")) }), jQuery(".shortcode_toggles_item_title").click(function() { jQuery(this).next().slideToggle("fast", function() { content_update() }), jQuery(this).toggleClass("state-active") }), jQuery(".shortcode_accordion_item_title.expanded_yes, .shortcode_toggles_item_title.expanded_yes").each(function() { jQuery(this).next().slideDown("fast", function() { content_update() }), jQuery(this).addClass("state-active") }), jQuery(window).width() > 760 ? jQuery(".shortcode_counter").each(function() {
    if (jQuery(this).offset().top < jQuery(window).height()) {
      if (!jQuery(this).hasClass("done")) {
        var t = jQuery(this).find(".stat_count").attr("data-count");
        jQuery(this).find(".stat_temp").stop().animate({ width: t }, {
          duration: 3e3,
          step: function(t) {
            var e = Math.floor(t);
            jQuery(this).parents(".counter_wrapper").find(".stat_count").html(e)
          }
        }), jQuery(this).addClass("done"), jQuery(this).find(".stat_count")
      }
    } else jQuery(this).waypoint(function() {
      if (!jQuery(this).hasClass("done")) {
        var t = jQuery(this).find(".stat_count").attr("data-count");
        jQuery(this).find(".stat_temp").stop().animate({ width: t }, {
          duration: 3e3,
          step: function(t) {
            var e = Math.floor(t);
            jQuery(this).parents(".counter_wrapper").find(".stat_count").html(e)
          }
        }), jQuery(this).addClass("done"), jQuery(this).find(".stat_count")
      }
    }, { offset: "bottom-in-view" })
  }) : jQuery(".shortcode_counter").each(function() {
    var t = jQuery(this).find(".stat_count").attr("data-count");
    jQuery(this).find(".stat_temp").animate({ width: t }, {
      duration: 3e3,
      step: function(t) {
        var e = Math.floor(t);
        jQuery(this).parents(".counter_wrapper").find(".stat_count").html(e)
      }
    }), jQuery(this).find(".stat_count")
  }, { offset: "bottom-in-view" }), jQuery(".shortcode_tabs").each(function() {
    var t = 1;
    jQuery(this).find(".shortcode_tab_item_title").each(function() { jQuery(this).addClass("it" + t), jQuery(this).attr("whatopen", "body" + t), jQuery(this).addClass("head" + t), jQuery(this).parents(".shortcode_tabs").find(".all_heads_cont").append(this), t++ });
    var t = 1;
    jQuery(this).find(".shortcode_tab_item_body").each(function() { jQuery(this).addClass("body" + t), jQuery(this).addClass("it" + t), jQuery(this).parents(".shortcode_tabs").find(".all_body_cont").append(this), t++ }), jQuery(this).find(".expand_yes").addClass("active");
    var e = jQuery(this).find(".expand_yes").attr("whatopen");
    jQuery(this).find("." + e).addClass("active")
  }), jQuery(document).on("click", ".shortcode_tab_item_title", function() {
    jQuery(this).parents(".shortcode_tabs").find(".shortcode_tab_item_body").removeClass("active"), jQuery(this).parents(".shortcode_tabs").find(".shortcode_tab_item_title").removeClass("active");
    var t = jQuery(this).attr("whatopen");
    jQuery(this).parents(".shortcode_tabs").find("." + t).addClass("active"), jQuery(this).addClass("active"), content_update()
  }), jQuery(".shortcode_messagebox").find(".box_close").click(function() { jQuery(this).parents(".module_messageboxes").fadeOut(400) }), jQuery(".chart").each(function() { jQuery(this).css({ "font-size": jQuery(this).parents(".skills_list").attr("data-fontsize"), "line-height": jQuery(this).parents(".skills_list").attr("data-size") }), jQuery(this).find("span").css("font-size", jQuery(this).parents(".skills_list").attr("data-fontsize")) }), jQuery(window).width() > 760 ? jQuery(".skill_li").waypoint(function() { jQuery(".chart").each(function() { jQuery(this).easyPieChart({ barColor: jQuery(this).parents("ul.skills_list").attr("data-color"), trackColor: jQuery(this).parents("ul.skills_list").attr("data-bg"), scaleColor: !1, lineCap: "square", lineWidth: parseInt(jQuery(this).parents("ul.skills_list").attr("data-width")), size: parseInt(jQuery(this).parents("ul.skills_list").attr("data-size")), animate: 1500 }) }) }, { offset: "bottom-in-view" }) : jQuery(".chart").each(function() { jQuery(this).easyPieChart({ barColor: jQuery(this).parents("ul.skills_list").attr("data-color"), trackColor: jQuery(this).parents("ul.skills_list").attr("data-bg"), scaleColor: !1, lineCap: "square", lineWidth: parseInt(jQuery(this).parents("ul.skills_list").attr("data-width")), size: parseInt(jQuery(this).parents("ul.skills_list").attr("data-size")), animate: 1500 }) }), jQuery("#ajax-contact-form").submit(function() {
    var e = t(this).serialize();
    return t.ajax({
      type: "POST",
      url: "contact_form/contact_process.php",
      data: e,
      success: function(t) {
        if ("OK" == t) {
          var e = '<div class="notification_ok">Your message has been sent. Thank you!</div>';
          jQuery("#fields").hide()
        } else var e = t;
        jQuery("#note").html(e)
      }
    }), !1
  })
}), jQuery(window).resize(function() {
  "use strict";
  window_h = jQuery(window).height(), window_w = jQuery(window).width(), content_update()
}), jQuery(window).load(function() {
  "use strict";
  content_update()
});
var setTop = 0;
if (jQuery(window).resize(function() {
    "use strict";
    pp_block.size() && (setTimeout("centerWindow404()", 500), setTimeout("centerWindow404()", 1e3))
  }), jQuery.fn.fs_gallery = function(t) {
    var e = (jQuery(this), this),
      i = setInterval("nextSlide()", t.slide_time);
    for (0 == t.autoplay ? (playpause = "fs_play", clearInterval(i)) : playpause = "fs_pause", 0 == t.show_controls ? (show_class = "hide_me", controls_class = "open_controls") : (show_class = "", controls_class = ""), e.append('<div class="fs_gallery_wrapper"><ul class="' + t.fit + " fs_gallery_container " + t.fx + '"/></div>'), $fs_container = jQuery(".fs_gallery_container"), e.append('<div class="fs_controls_wrapper"><div class="fs_thmb_viewport ' + show_class + '"><div class="fs_thmb_wrapper"><ul class="fs_thmb_list" style="width:' + 128 * t.slides.length + 'px"></ul></div></div><div class="fs_title_wrapper ' + show_class + '"><h1 class="fs_title"></h1><h3 class="fs_descr"></h3></div><div class="fs_controls ' + show_class + '"><a href="javascript:void(0)" class="fs_slider_prev"/><a href="javascript:void(0)" id="fs_play-pause" class="' + playpause + '"></a><a href="javascript:void(0)" class="fs_slider_next"/><a href="javascript:void(0)" class="close_controls"/></div></div>'), e.append(), $fs_thmb = jQuery(".fs_thmb_list"), 0 == t.autoplay && $fs_thmb.addClass("paused"), $fs_thmb_viewport = jQuery(".fs_thmb_viewport"), $fs_title = jQuery(".fs_title"), $fs_descr = jQuery(".fs_descr"), thisSlide = 0; thisSlide <= t.slides.length - 1;) $fs_container.append('<li class="fs_slide slide' + thisSlide + '" data-count="' + thisSlide + '" data-src="' + t.slides[thisSlide].image + '"></li>'), $fs_thmb.append('<li class="fs_slide_thmb slide' + thisSlide + '" data-count="' + thisSlide + '"><img alt="' + t.slides[thisSlide].alt + " " + thisSlide + '" src="' + t.slides[thisSlide].thmb + '"/><div class="fs_thmb_fadder"></div></li>'), thisSlide++;
    return $fs_container.find("li.slide0").addClass("current-slide").attr("style", "background:url(" + $fs_container.find("li.slide0").attr("data-src") + ") no-repeat; background-size: contain;"), $fs_container.find("li.slide1").attr("style", "background:url(" + $fs_container.find("li.slide1").attr("data-src") + ") no-repeat; background-size: contain;"), $fs_title.html(t.slides[0].title).css("color", t.slides[0].titleColor), $fs_descr.html(t.slides[0].description).css("color", t.slides[0].descriptionColor), $fs_thmb_viewport.width(jQuery(window).width()), jQuery(".fs_slide_thmb").click(function() { goToSlide(parseInt(jQuery(this).attr("data-count"))) }), jQuery(".fs_slider_prev").click(function() { prevSlide() }), jQuery(".fs_slider_next").click(function() { nextSlide() }), jQuery(document.documentElement).keyup(function(t) { 37 == t.keyCode || 40 == t.keyCode ? prevSlide() : (39 == t.keyCode || 38 == t.keyCode) && nextSlide() }), jQuery(".fs_slide").on("swipeleft", function() { nextSlide() }), jQuery(".fs_slide").on("swiperight", function() { prevSlide() }), jQuery(".fs_slide").on("movestart", function(t) {
      (t.distX > t.distY && t.distX < -t.distY || t.distX < t.distY && t.distX > -t.distY) && t.preventDefault()
    }), jQuery("#fs_play-pause").click(function() { jQuery(this).hasClass("fs_pause") ? ($fs_thmb.addClass("paused"), jQuery(this).removeClass("fs_pause").addClass("fs_play"), clearInterval(i)) : ($fs_thmb.removeClass("paused"), jQuery(this).removeClass("fs_play").addClass("fs_pause"), i = setInterval("nextSlide()", t.slide_time)) }), start = function() { $fs_thmb.removeClass("paused"), i = setInterval("nextSlide()", t.slide_time) }, nextSlide = function() {
      clearInterval(i), thisSlide = parseInt($fs_container.find(".current-slide").attr("data-count")), thisSlide++, cleanSlide = thisSlide - 2, nxtSlide = thisSlide + 1, thisSlide == $fs_container.find("li").size() && (thisSlide = 0, cleanSlide = $fs_container.find("li").size() - 3, nxtSlide = thisSlide + 1), 1 == thisSlide && (cleanSlide = $fs_container.find("li").size() - 2), $fs_title.fadeOut(300), $fs_descr.fadeOut(300, function() {
        $fs_title.html(t.slides[thisSlide].title).css("color", t.slides[thisSlide].titleColor), $fs_descr.html(t.slides[thisSlide].description).css("color", t.slides[thisSlide].descriptionColor), $fs_title.fadeIn(300), $fs_descr.fadeIn(300)
      }), $fs_container.find(".slide" + cleanSlide).attr("style", ""), $fs_container.find(".slide" + thisSlide).attr("style", "background:url(" + $fs_container.find(".slide" + thisSlide).attr("data-src") + ") no-repeat; background-size: contain;"), $fs_container.find(".slide" + nxtSlide).attr("style", "background:url(" + $fs_container.find(".slide" + (thisSlide + 1)).attr("data-src") + ") no-repeat; background-size: contain;"), jQuery(".current-slide").removeClass("current-slide"), jQuery(".slide" + thisSlide).addClass("current-slide"), $fs_thmb.hasClass("paused") || (i = setInterval("nextSlide()", t.slide_time))
    }, prevSlide = function() { clearInterval(i), thisSlide = parseInt($fs_container.find(".current-slide").attr("data-count")), thisSlide--, nxtSlide = thisSlide - 1, cleanSlide = thisSlide + 2, thisSlide < 0 && (thisSlide = $fs_container.find("li").size() - 1, cleanSlide = 1), thisSlide == $fs_container.find("li").size() - 2 && (cleanSlide = 0), $fs_title.fadeOut(300), $fs_descr.fadeOut(300, function() { $fs_title.html(t.slides[thisSlide].title).css("color", t.slides[thisSlide].titleColor), $fs_descr.html(t.slides[thisSlide].description).css("color", t.slides[thisSlide].descriptionColor), $fs_title.fadeIn(300), $fs_descr.fadeIn(300) }), $fs_container.find(".slide" + cleanSlide).attr("style", ""), $fs_container.find(".slide" + thisSlide).attr("style", "background:url(" + $fs_container.find(".slide" + thisSlide).attr("data-src") + ") no-repeat; background-size: contain;"), $fs_container.find(".slide" + nxtSlide).attr("style", "background:url(" + $fs_container.find(".slide" + (thisSlide + 1)).attr("data-src") + ") no-repeat; background-size: contain;"), jQuery(".current-slide").removeClass("current-slide"), jQuery(".slide" + thisSlide).addClass("current-slide"), $fs_thmb.hasClass("paused") || (i = setInterval("nextSlide()", t.slide_time)) }, goToSlide = function(e) { clearInterval(i), oldSlide = parseInt($fs_container.find(".current-slide").attr("data-count")), thisSlide = e, $fs_title.fadeOut(300), $fs_descr.fadeOut(300, function() { $fs_title.html(t.slides[thisSlide].title).css("color", t.slides[thisSlide].titleColor), $fs_descr.html(t.slides[thisSlide].description).css("color", t.slides[thisSlide].descriptionColor), $fs_title.fadeIn(300), $fs_descr.fadeIn(300) }), $fs_container.find(".fs_slide").attr("style", ""), $fs_container.find(".slide" + thisSlide).attr("style", "background:url(" + $fs_container.find(".slide" + thisSlide).attr("data-src") + ") no-repeat; background-size: contain;"), $fs_container.find(".slide" + (thisSlide + 1)).attr("style", "background:url(" + $fs_container.find(".slide" + (thisSlide + 1)).attr("data-src") + ") no-repeat; background-size: contain;"), jQuery(".current-slide").removeClass("current-slide"), jQuery(".slide" + thisSlide).addClass("current-slide"), $fs_thmb.hasClass("paused") || (i = setInterval("nextSlide()", t.slide_time)) }, $fs_thmb_viewport.width(jQuery(window).width()).mouseenter(function() {
      var t = jQuery(this).width(),
        e = jQuery(".fs_thmb_list");
      window._s_top = parseInt(e.css("left")), window._sh = setInterval(function() {
        if (window._s_top >= 0 && window._sp > 0 || window._s_top < 0 && window._s_top > -(e.width() - t) || window._sp < 0 && window._s_top <= -(e.width() - t)) {
          var i = window._sp >= 0,
            n = Math.pow(15 * window._sp, 2),
            n = i ? n : -n;
          window._s_top -= n, window._s_top > 0 && (window._s_top = 0), window._s_top < -(e.width() - t) && (window._s_top = -(e.width() - t)), jQuery(".fs_thmb_list").width() > $fs_thmb_viewport.width() && e.stop().animate({ left: window._s_top }, 500)
        }
      }, 100)
    }).mouseleave(function() { clearInterval(window._sh) }).mousemove(function(t) { y = t.pageX, h = jQuery(this).width(), p = y / h, window._sp = y > .8 * jQuery(window).width() ? Math.round(50 * (p - .5)) / 50 : y < .2 * jQuery(window).width() ? Math.round(50 * (p - .5)) / 50 : 0 }), { start_slider: function() { return start() }, $this: this }
  }, jQuery(document).ready(function(t) {
    var e = t(".fs_thmb_list");
    e.mousedown(function() { e.addClass("clicked") }), e.mouseup(function() { e.removeClass("clicked") }), t(".fs_thmb_viewport").hover(function() { t(".fs_controls").addClass("up_me"), t(".fs_title_wrapper ").addClass("up_me") }, function() { t(".fs_controls").removeClass("up_me"), t(".fs_title_wrapper ").removeClass("up_me") })
  }), jQuery(window).resize(function() { jQuery(".fs_thmb_viewport").width(jQuery(window).width()), jQuery(".fs_thmb_list").css("left", "0px") }), jQuery(window).load(function() { jQuery(".fs_thmb_viewport").width(jQuery(window).width()), jQuery(".fs_thmb_list").css("left", "0px") }), function() {
    var t;
    $("#map-canvas").length > 0 && (t = $("h1").html(), window.the_geocoder = new google.maps.Geocoder, window.the_map = new google.maps.Map($("#map-canvas")[0], { zoom: 15, mapTypeId: google.maps.MapTypeId.ROADMAP, disableDefaultUI: !0 }), window.the_marker = new google.maps.Marker({ map: the_map, position: the_map.getCenter() }), the_geocoder.geocode({ address: t }, function(t, e) { return e === google.maps.GeocoderStatus.OK ? (the_map.setCenter(t[0].geometry.location), window.the_marker.setPosition(t[0].geometry.location)) : void 0 }))
  }.call(this), window.Modernizr = function(t, e, i) {
    function n(t) { v.cssText = t }

    function s(t, e) { return typeof t === e }

    function o(t, e) { return !!~("" + t).indexOf(e) }

    function r(t, e) { for (var n in t) { var s = t[n]; if (!o(s, "-") && v[s] !== i) return "pfx" == e ? s : !0 } return !1 }

    function a(t, e, n) { for (var o in t) { var r = e[t[o]]; if (r !== i) return n === !1 ? t[o] : s(r, "function") ? r.bind(n || e) : r } return !1 }

    function l(t, e, i) {
      var n = t.charAt(0).toUpperCase() + t.slice(1),
        o = (t + " " + b.join(n + " ") + n).split(" ");
      return s(e, "string") || s(e, "undefined") ? r(o, e) : (o = (t + " " + w.join(n + " ") + n).split(" "), a(o, e, i))
    }
    var h, c, d, u = "2.6.2",
      p = {},
      f = e.documentElement,
      m = "modernizr",
      g = e.createElement(m),
      v = g.style,
      y = ({}.toString, "Webkit Moz O ms"),
      b = y.split(" "),
      w = y.toLowerCase().split(" "),
      _ = {},
      x = [],
      k = x.slice,
      C = function(t, i, n, s) {
        var o, r, a, l, h = e.createElement("div"),
          c = e.body,
          d = c || e.createElement("body");
        if (parseInt(n, 10))
          for (; n--;) a = e.createElement("div"), a.id = s ? s[n] : m + (n + 1), h.appendChild(a);
        return o = ["&#173;", '<style id="s', m, '">', t, "</style>"].join(""), h.id = m, (c ? h : d).innerHTML += o, d.appendChild(h), c || (d.style.background = "", d.style.overflow = "hidden", l = f.style.overflow, f.style.overflow = "hidden", f.appendChild(d)), r = i(h, t), c ? h.parentNode.removeChild(h) : (d.parentNode.removeChild(d), f.style.overflow = l), !!r
      },
      S = function(e) { var i = t.matchMedia || t.msMatchMedia; if (i) return i(e).matches; var n; return C("@media " + e + " { #" + m + " { position: absolute; } }", function(e) { n = "absolute" == (t.getComputedStyle ? getComputedStyle(e, null) : e.currentStyle).position }), n },
      T = {}.hasOwnProperty;
    d = s(T, "undefined") || s(T.call, "undefined") ? function(t, e) { return e in t && s(t.constructor.prototype[e], "undefined") } : function(t, e) { return T.call(t, e) }, Function.prototype.bind || (Function.prototype.bind = function(t) {
      var e = this;
      if ("function" != typeof e) throw new TypeError;
      var i = k.call(arguments, 1),
        n = function() {
          if (this instanceof n) {
            var s = function() {};
            s.prototype = e.prototype;
            var o = new s,
              r = e.apply(o, i.concat(k.call(arguments)));
            return Object(r) === r ? r : o
          }
          return e.apply(t, i.concat(k.call(arguments)))
        };
      return n
    }), _.cssanimations = function() { return l("animationName") }, _.csstransitions = function() { return l("transition") };
    for (var E in _) d(_, E) && (c = E.toLowerCase(), p[c] = _[E](), x.push((p[c] ? "" : "no-") + c));
    return p.addTest = function(t, e) {
      if ("object" == typeof t)
        for (var n in t) d(t, n) && p.addTest(n, t[n]);
      else {
        if (t = t.toLowerCase(), p[t] !== i) return p;
        e = "function" == typeof e ? e() : e, "undefined" != typeof enableClasses && enableClasses && (f.className += " " + (e ? "" : "no-") + t), p[t] = e
      }
      return p
    }, n(""), g = h = null, p._version = u, p._domPrefixes = w, p._cssomPrefixes = b, p.mq = S, p.testProp = function(t) { return r([t]) }, p.testAllProps = l, p.testStyles = C, p
  }(this, this.document), function(t, e, i) {
    function n(t) { return "[object Function]" == g.call(t) }

    function s(t) { return "string" == typeof t }

    function o() {}

    function r(t) { return !t || "loaded" == t || "complete" == t || "uninitialized" == t }

    function a() {
      var t = v.shift();
      y = 1, t ? t.t ? f(function() {
        ("c" == t.t ? u.injectCss : u.injectJs)(t.s, 0, t.a, t.x, t.e, 1)
      }, 0) : (t(), a()) : y = 0
    }

    function l(t, i, n, s, o, l, h) {
      function c(e) { if (!p && r(d.readyState) && (b.r = p = 1, !y && a(), d.onload = d.onreadystatechange = null, e)) { "img" != t && f(function() { _.removeChild(d) }, 50); for (var n in T[i]) T[i].hasOwnProperty(n) && T[i][n].onload() } }
      var h = h || u.errorTimeout,
        d = e.createElement(t),
        p = 0,
        g = 0,
        b = { t: n, s: i, e: o, a: l, x: h };
      1 === T[i] && (g = 1, T[i] = []), "object" == t ? d.data = i : (d.src = i, d.type = t), d.width = d.height = "0", d.onerror = d.onload = d.onreadystatechange = function() { c.call(this, g) }, v.splice(s, 0, b), "img" != t && (g || 2 === T[i] ? (_.insertBefore(d, w ? null : m), f(c, h)) : T[i].push(d))
    }

    function h(t, e, i, n, o) { return y = 0, e = e || "j", s(t) ? l("c" == e ? k : x, t, e, this.i++, i, n, o) : (v.splice(this.i++, 0, t), 1 == v.length && a()), this }

    function c() { var t = u; return t.loader = { load: h, i: 0 }, t }
    var d, u, p = e.documentElement,
      f = t.setTimeout,
      m = e.getElementsByTagName("script")[0],
      g = {}.toString,
      v = [],
      y = 0,
      b = "MozAppearance" in p.style,
      w = b && !!e.createRange().compareNode,
      _ = w ? p : m.parentNode,
      p = t.opera && "[object Opera]" == g.call(t.opera),
      p = !!e.attachEvent && !p,
      x = b ? "object" : p ? "script" : "img",
      k = p ? "script" : x,
      C = Array.isArray || function(t) { return "[object Array]" == g.call(t) },
      S = [],
      T = {},
      E = { timeout: function(t, e) { return e.length && (t.timeout = e[0]), t } };
    u = function(t) {
      function e(t) {
        var e, i, n, t = t.split("!"),
          s = S.length,
          o = t.pop(),
          r = t.length,
          o = { url: o, origUrl: o, prefixes: t };
        for (i = 0; r > i; i++) n = t[i].split("="), (e = E[n.shift()]) && (o = e(o, n));
        for (i = 0; s > i; i++) o = S[i](o);
        return o
      }

      function r(t, s, o, r, a) {
        var l = e(t),
          h = l.autoCallback;
        l.url.split(".").pop().split("?").shift(), l.bypass || (s && (s = n(s) ? s : s[t] || s[r] || s[t.split("/").pop().split("?")[0]]), l.instead ? l.instead(t, s, o, r, a) : (T[l.url] ? l.noexec = !0 : T[l.url] = 1, o.load(l.url, l.forceCSS || !l.forceJS && "css" == l.url.split(".").pop().split("?").shift() ? "c" : i, l.noexec, l.attrs, l.timeout), (n(s) || n(h)) && o.load(function() { c(), s && s(l.origUrl, a, r), h && h(l.origUrl, a, r), T[l.url] = 2 })))
      }

      function a(t, e) {
        function i(t, i) {
          if (t) {
            if (s(t)) i || (d = function() {
              var t = [].slice.call(arguments);
              u.apply(this, t), p()
            }), r(t, d, e, 0, h);
            else if (Object(t) === t)
              for (l in a = function() { var e, i = 0; for (e in t) t.hasOwnProperty(e) && i++; return i }(), t) t.hasOwnProperty(l) && (!i && !--a && (n(d) ? d = function() {
                var t = [].slice.call(arguments);
                u.apply(this, t), p()
              } : d[l] = function(t) {
                return function() {
                  var e = [].slice.call(arguments);
                  t && t.apply(this, e), p()
                }
              }(u[l])), r(t[l], d, e, l, h))
          } else !i && p()
        }
        var a, l, h = !!t.test,
          c = t.load || t.both,
          d = t.callback || o,
          u = d,
          p = t.complete || o;
        i(h ? t.yep : t.nope, !!c), c && i(c)
      }
      var l, h, d = this.yepnope.loader;
      if (s(t)) r(t, 0, d, 0);
      else if (C(t))
        for (l = 0; l < t.length; l++) h = t[l], s(h) ? r(h, 0, d, 0) : C(h) ? u(h) : Object(h) === h && a(h, d);
      else Object(t) === t && a(t, d)
    }, u.addPrefix = function(t, e) { E[t] = e }, u.addFilter = function(t) { S.push(t) }, u.errorTimeout = 1e4, null == e.readyState && e.addEventListener && (e.readyState = "loading", e.addEventListener("DOMContentLoaded", d = function() { e.removeEventListener("DOMContentLoaded", d, 0), e.readyState = "complete" }, 0)), t.yepnope = c(), t.yepnope.executeStack = a, t.yepnope.injectJs = function(t, i, n, s, l, h) {
      var c, d, p = e.createElement("script"),
        s = s || u.errorTimeout;
      p.src = t;
      for (d in n) p.setAttribute(d, n[d]);
      i = h ? a : i || o, p.onreadystatechange = p.onload = function() {!c && r(p.readyState) && (c = 1, i(), p.onload = p.onreadystatechange = null) }, f(function() { c || (c = 1, i(1)) }, s), l ? p.onload() : m.parentNode.insertBefore(p, m)
    }, t.yepnope.injectCss = function(t, i, n, s, r, l) {
      var h, s = e.createElement("link"),
        i = l ? a : i || o;
      s.href = t, s.rel = "stylesheet", s.type = "text/css";
      for (h in n) s.setAttribute(h, n[h]);
      r || (m.parentNode.insertBefore(s, m), f(i, 0))
    }
  }(this, document), Modernizr.load = function() { yepnope.apply(window, [].slice.call(arguments, 0)) }, ! function(t, e) { "function" == typeof define && define.amd ? define(e) : "object" == typeof exports ? module.exports = e(require, exports, module) : t.scrollReveal = e() }(this, function() {
    return window.scrollReveal = function(t) {
      "use strict";

      function e(i) { return this instanceof e ? (o = this, o.elems = {}, o.serial = 1, o.blocked = !1, o.config = n(o.defaults, i), o.isMobile() && !o.config.mobile || !o.isSupported() ? void o.destroy() : (o.config.viewport === t.document.documentElement ? (t.addEventListener("scroll", s, !1), t.addEventListener("resize", s, !1)) : o.config.viewport.addEventListener("scroll", s, !1), void o.init(!0))) : new e(i) }
      var i, n, s, o;
      return e.prototype = {
        defaults: { enter: "bottom", move: "8px", over: "0.6s", wait: "0s", easing: "ease", scale: { direction: "up", power: "5%" }, rotate: { x: 0, y: 0, z: 0 }, opacity: 0, mobile: !1, reset: !1, viewport: t.document.documentElement, delay: "once", vFactor: .6, complete: function() {} },
        init: function(t) {
          var e, i, n;
          n = Array.prototype.slice.call(o.config.viewport.querySelectorAll("[data-sr]")), n.forEach(function(t) { e = o.serial++, i = o.elems[e] = { domEl: t }, i.config = o.configFactory(i), i.styles = o.styleFactory(i), i.seen = !1, t.removeAttribute("data-sr"), t.setAttribute("style", i.styles.inline + i.styles.initial) }), o.scrolled = o.scrollY(), o.animate(t)
        },
        animate: function(t) {
          function e(t) {
            var e = o.elems[t];
            setTimeout(function() { e.domEl.setAttribute("style", e.styles.inline), e.config.complete(e.domEl), delete o.elems[t] }, e.styles.duration)
          }
          var i, n, s;
          for (i in o.elems) o.elems.hasOwnProperty(i) && (n = o.elems[i], s = o.isElemInViewport(n), s ? ("always" === o.config.delay || "onload" === o.config.delay && t || "once" === o.config.delay && !n.seen ? n.domEl.setAttribute("style", n.styles.inline + n.styles.target + n.styles.transition) : n.domEl.setAttribute("style", n.styles.inline + n.styles.target + n.styles.reset), n.seen = !0, n.config.reset || n.animating || (n.animating = !0, e(i))) : !s && n.config.reset && n.domEl.setAttribute("style", n.styles.inline + n.styles.initial + n.styles.reset));
          o.blocked = !1
        },
        configFactory: function(t) {
          var e = {},
            i = {},
            s = t.domEl.getAttribute("data-sr").split(/[, ]+/);
          return s.forEach(function(t, i) {
            switch (t) {
              case "enter":
                e.enter = s[i + 1];
                break;
              case "wait":
                e.wait = s[i + 1];
                break;
              case "move":
                e.move = s[i + 1];
                break;
              case "ease":
                e.move = s[i + 1], e.ease = "ease";
                break;
              case "ease-in":
                if ("up" == s[i + 1] || "down" == s[i + 1]) { e.scale.direction = s[i + 1], e.scale.power = s[i + 2], e.easing = "ease-in"; break } e.move = s[i + 1], e.easing = "ease-in";
                break;
              case "ease-in-out":
                if ("up" == s[i + 1] || "down" == s[i + 1]) { e.scale.direction = s[i + 1], e.scale.power = s[i + 2], e.easing = "ease-in-out"; break } e.move = s[i + 1], e.easing = "ease-in-out";
                break;
              case "ease-out":
                if ("up" == s[i + 1] || "down" == s[i + 1]) { e.scale.direction = s[i + 1], e.scale.power = s[i + 2], e.easing = "ease-out"; break } e.move = s[i + 1], e.easing = "ease-out";
                break;
              case "hustle":
                if ("up" == s[i + 1] || "down" == s[i + 1]) { e.scale.direction = s[i + 1], e.scale.power = s[i + 2], e.easing = "cubic-bezier( 0.6, 0.2, 0.1, 1 )"; break } e.move = s[i + 1], e.easing = "cubic-bezier( 0.6, 0.2, 0.1, 1 )";
                break;
              case "over":
                e.over = s[i + 1];
                break;
              case "flip":
              case "pitch":
                e.rotate = e.rotate || {}, e.rotate.x = s[i + 1];
                break;
              case "spin":
              case "yaw":
                e.rotate = e.rotate || {}, e.rotate.y = s[i + 1];
                break;
              case "roll":
                e.rotate = e.rotate || {}, e.rotate.z = s[i + 1];
                break;
              case "reset":
                e.reset = "no" == s[i - 1] ? !1 : !0;
                break;
              case "scale":
                if (e.scale = {}, "up" == s[i + 1] || "down" == s[i + 1]) { e.scale.direction = s[i + 1], e.scale.power = s[i + 2]; break } e.scale.power = s[i + 1];
                break;
              case "vFactor":
              case "vF":
                e.vFactor = s[i + 1];
                break;
              case "opacity":
                e.opacity = s[i + 1];
                break;
              default:
                return
            }
          }), i = n(i, o.config), i = n(i, e), "top" === i.enter || "bottom" === i.enter ? i.axis = "Y" : ("left" === i.enter || "right" === i.enter) && (i.axis = "X"), ("top" === i.enter || "left" === i.enter) && (i.move = "-" + i.move), i
        },
        styleFactory: function(t) {
          function e() { 0 !== parseInt(a.move) && (n += " translate" + a.axis + "(" + a.move + ")", o += " translate" + a.axis + "(0)"), 0 !== parseInt(a.scale.power) && ("up" === a.scale.direction ? a.scale.value = 1 - .01 * parseFloat(a.scale.power) : "down" === a.scale.direction && (a.scale.value = 1 + .01 * parseFloat(a.scale.power)), n += " scale(" + a.scale.value + ")", o += " scale(1)"), a.rotate.x && (n += " rotateX(" + a.rotate.x + ")", o += " rotateX(0)"), a.rotate.y && (n += " rotateY(" + a.rotate.y + ")", o += " rotateY(0)"), a.rotate.z && (n += " rotateZ(" + a.rotate.z + ")", o += " rotateZ(0)"), n += "; opacity: " + a.opacity + "; ", o += "; opacity: 1; " }
          var i, n, s, o, r, a = t.config,
            l = 1e3 * (parseFloat(a.over) + parseFloat(a.wait));
          return i = t.domEl.getAttribute("style") ? t.domEl.getAttribute("style") + "; visibility: visible; " : "visibility: visible; ", r = "-webkit-transition: -webkit-transform " + a.over + " " + a.easing + " " + a.wait + ", opacity " + a.over + " " + a.easing + " " + a.wait + "; transition: transform " + a.over + " " + a.easing + " " + a.wait + ", opacity " + a.over + " " + a.easing + " " + a.wait + "; -webkit-perspective: 1000;-webkit-backface-visibility: hidden;", s = "-webkit-transition: -webkit-transform " + a.over + " " + a.easing + " 0s, opacity " + a.over + " " + a.easing + " 0s; transition: transform " + a.over + " " + a.easing + " 0s, opacity " + a.over + " " + a.easing + " 0s; -webkit-perspective: 1000; -webkit-backface-visibility: hidden; ", n = "transform:", o = "transform:", e(), n += "-webkit-transform:", o += "-webkit-transform:", e(), { transition: r, initial: n, target: o, reset: s, inline: i, duration: l }
        },
        getViewportH: function() {
          var e = o.config.viewport.clientHeight,
            i = t.innerHeight;
          return o.config.viewport === t.document.documentElement && i > e ? i : e
        },
        scrollY: function() { return o.config.viewport === t.document.documentElement ? t.pageYOffset : o.config.viewport.scrollTop + o.config.viewport.offsetTop },
        getOffset: function(t) {
          var e = 0,
            i = 0;
          do isNaN(t.offsetTop) || (e += t.offsetTop), isNaN(t.offsetLeft) || (i += t.offsetLeft); while (t = t.offsetParent);
          return { top: e, left: i }
        },
        isElemInViewport: function(e) {
          function i() {
            var t = r + s * l,
              e = a - s * l,
              i = o.scrolled + o.getViewportH(),
              n = o.scrolled;
            return i > t && e > n
          }

          function n() {
            var i = e.domEl,
              n = i.currentStyle || t.getComputedStyle(i, null);
            return "fixed" === n.position
          }
          var s = e.domEl.offsetHeight,
            r = o.getOffset(e.domEl).top,
            a = r + s,
            l = e.config.vFactor || 0;
          return i() || n()
        },
        isMobile: function() { var e = navigator.userAgent || navigator.vendor || t.opera; return /(ipad|playbook|silk|android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(e) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(e.substr(0, 4)) ? !0 : !1 },
        isSupported: function() {
          for (var t = document.createElement("sensor"), e = "Webkit,Moz,O,".split(","), i = ("transition " + e.join("transition,")).split(","), n = 0; n < i.length; n++)
            if ("" === !t.style[i[n]]) return !1;
          return !0
        },
        destroy: function() {
          var t = o.config.viewport,
            e = Array.prototype.slice.call(t.querySelectorAll("[data-sr]"));
          e.forEach(function(t) { t.removeAttribute("data-sr") })
        }
      }, s = function() { o.blocked || (o.blocked = !0, o.scrolled = o.scrollY(), i(function() { o.animate() })) }, n = function(t, e) { for (var i in e) e.hasOwnProperty(i) && (t[i] = e[i]); return t }, i = function() { return t.requestAnimationFrame || t.webkitRequestAnimationFrame || t.mozRequestAnimationFrame || function(e) { t.setTimeout(e, 1e3 / 60) } }(), e
    }(window), scrollReveal
  }), "undefined" == typeof jQuery) throw new Error("Froala requires jQuery");
! function(t) {
  "use strict";
  var e = function(i, n) { return this.options = t.extend({}, e.DEFAULTS, t(i).data(), "object" == typeof n && n), this.options.unsupportedAgents.test(navigator.userAgent) ? !1 : (this.valid_nodes = t.merge([], e.VALID_NODES), this.valid_nodes = t.merge(this.valid_nodes, t.map(Object.keys(this.options.blockTags), function(t) { return t.toUpperCase() })), this.browser = e.browser(), this.disabledList = [], this._id = ++e.count, this._events = {}, this.blurred = !0, this.$original_element = t(i), this.document = i.ownerDocument, this.window = "defaultView" in this.document ? this.document.defaultView : this.document.parentWindow, this.$document = t(this.document), this.$window = t(this.window), this.br = this.browser.msie && t.Editable.getIEversion() <= 10 ? "" : "<br/>", this.init(i), void t(i).on("editable.focus", t.proxy(function() { for (var e = 1; e <= t.Editable.count; e++) e != this._id && this.$window.trigger("blur." + e) }, this))) };
  e.initializers = [], e.count = 0, e.VALID_NODES = ["P", "DIV", "LI", "TD", "TH"], e.LANGS = [], e.INVISIBLE_SPACE = "&#x200b;", e.DEFAULTS = { allowComments: !0, allowScript: !1, allowStyle: !1, allowedAttrs: ["accept", "accept-charset", "accesskey", "action", "align", "alt", "async", "autocomplete", "autofocus", "autoplay", "autosave", "background", "bgcolor", "border", "charset", "cellpadding", "cellspacing", "checked", "cite", "class", "color", "cols", "colspan", "content", "contenteditable", "contextmenu", "controls", "coords", "data", "data-.*", "datetime", "default", "defer", "dir", "dirname", "disabled", "download", "draggable", "dropzone", "enctype", "for", "form", "formaction", "headers", "height", "hidden", "high", "href", "hreflang", "http-equiv", "icon", "id", "ismap", "itemprop", "keytype", "kind", "label", "lang", "language", "list", "loop", "low", "max", "maxlength", "media", "method", "min", "multiple", "name", "novalidate", "open", "optimum", "pattern", "ping", "placeholder", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "reversed", "rows", "rowspan", "sandbox", "scope", "scoped", "scrolling", "seamless", "selected", "shape", "size", "sizes", "span", "src", "srcdoc", "srclang", "srcset", "start", "step", "summary", "spellcheck", "style", "tabindex", "target", "title", "type", "translate", "usemap", "value", "valign", "width", "wrap"], allowedTags: ["a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo", "blockquote", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "i", "iframe", "img", "input", "ins", "kbd", "keygen", "label", "legend", "li", "link", "main", "map", "mark", "menu", "menuitem", "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "queue", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr"], alwaysBlank: !1, alwaysVisible: !1, autosave: !1, autosaveInterval: 1e4, beautifyCode: !0, blockTags: { n: "Normal", blockquote: "Quote", pre: "Code", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", h5: "Heading 5", h6: "Heading 6" }, buttons: ["bold", "italic", "underline", "strikeThrough", "fontSize", "fontFamily", "color", "sep", "formatBlock", "blockStyle", "align", "insertOrderedList", "insertUnorderedList", "outdent", "indent", "sep", "createLink", "insertImage", "insertVideo", "insertHorizontalRule", "undo", "redo", "html"], crossDomain: !0, convertMailAddresses: !0, customButtons: {}, customDropdowns: {}, customText: !1, defaultTag: "P", direction: "ltr", disableRightClick: !1, editInPopup: !1, editorClass: "", formatTags: ["p", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "div", "ul", "ol", "li", "table", "tbody", "thead", "tfoot", "tr", "th", "td", "body", "head", "html", "title", "meta", "link", "base", "script", "style"], headers: {}, height: "auto", icons: {}, inlineMode: !0, initOnClick: !1, fullPage: !1, language: "en_us", linkList: [], linkText: !1, linkClasses: {}, linkAttributes: {}, linkAutoPrefix: "", maxHeight: "auto", minHeight: "auto", multiLine: !0, noFollow: !0, paragraphy: !0, placeholder: "Type something", plainPaste: !1, preloaderSrc: "", saveURL: null, saveParam: "body", saveParams: {}, saveRequestType: "POST", scrollableContainer: "body", simpleAmpersand: !1, shortcuts: !0, shortcutsAvailable: ["show", "bold", "italic", "underline", "createLink", "insertImage", "indent", "outdent", "html", "formatBlock n", "formatBlock h1", "formatBlock h2", "formatBlock h3", "formatBlock h4", "formatBlock h5", "formatBlock h6", "formatBlock blockquote", "formatBlock pre", "strikeThrough"], showNextToCursor: !1, spellcheck: !1, theme: null, toolbarFixed: !0, trackScroll: !1, unlinkButton: !0, useClasses: !0, tabSpaces: !0, typingTimer: 500, pastedImagesUploadRequestType: "POST", pastedImagesUploadURL: "http://i.froala.com/upload_base64", unsupportedAgents: /Opera Mini/i, useFrTag: !1, width: "auto", withCredentials: !1, zIndex: 2e3 }, e.prototype.destroy = function() {
    this.sync(), this.options.useFrTag && this.addFrTag(), this.hide(), this.isHTML && this.html(), this.$bttn_wrapper && this.$bttn_wrapper.html("").removeData().remove(), this.$editor && this.$editor.html("").removeData().remove(), this.raiseEvent("destroy"), this.$popup_editor && this.$popup_editor.html("").removeData().remove(), this.$placeholder && this.$placeholder.html("").removeData().remove(), clearTimeout(this.ajaxInterval), clearTimeout(this.typingTimer), this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop"), this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop", "**"), this.$window.off("mouseup." + this._id), this.$window.off("keydown." + this._id), this.$window.off("keyup." + this._id), this.$window.off("blur." + this._id), this.$window.off("hide." + this._id), this.$window.off("scroll." + this._id), this.$window.off("resize." + this._id), this.$window.off("orientationchange." + this._id), this.$document.off("selectionchange." + this._id), this.$original_element.off("editable"), void 0 !== this.$upload_frame && this.$upload_frame.remove(), this.$textarea && (this.$box.remove(), this.$textarea.removeData("fa.editable"), this.$textarea.show());
    for (var t in this._events) delete this._events[t];
    this.$placeholder && this.$placeholder.remove(), this.isLink ? this.$element.removeData("fa.editable") : (this.$wrapper ? this.$wrapper.replaceWith(this.getHTML(!1, !1)) : this.$element.replaceWith(this.getHTML(!1, !1)), this.$box && !this.editableDisabled && (this.$box.removeClass("froala-box f-rtl"), this.$box.find(".html-switch").remove(), this.$box.removeData("fa.editable"), clearTimeout(this.typingTimer))), this.$lb && this.$lb.remove()
  }, e.prototype.triggerEvent = function(e, i, n, s) { void 0 === n && (n = !0), void 0 === s && (s = !1), n === !0 && (this.isResizing() || this.editableDisabled || this.imageMode || !s || this.cleanify(), this.sync()); var o = !0; return i || (i = []), o = this.$original_element.triggerHandler("editable." + e, t.merge([this], i)), void 0 === o ? !0 : o }, e.prototype.syncStyle = function() {
    if (this.options.fullPage) {
      var t = this.$element.html().match(/\[style[^\]]*\].*\[\/style\]/gi);
      if (this.$document.find("head style[data-id]").remove(), t)
        for (var e = 0; e < t.length; e++) this.$document.find("head").append(t[e].replace(/\[/gi, "<").replace(/\]/gi, ">"))
    }
  }, e.prototype.sync = function() {
    if (!this.isHTML) {
      this.raiseEvent("sync"), this.disableImageResize(), this.isLink || this.isImage || this.checkPlaceholder();
      var t = this.getHTML();
      this.trackHTML !== t && null != this.trackHTML ? (this.refreshImageList(), this.refreshButtons(), this.trackHTML = t, this.$textarea && this.$textarea.val(t), this.doingRedo || this.saveUndoStep(), this.triggerEvent("contentChanged", [], !1)) : null == this.trackHTML && (this.trackHTML = t), this.syncStyle()
    }
  }, e.prototype.emptyElement = function(e) {
    if ("IMG" == e.tagName || t(e).find("img").length > 0) return !1;
    if (t(e).find("input, iframe, object").length > 0) return !1;
    for (var i = t(e).text(), n = 0; n < i.length; n++)
      if ("\n" !== i[n] && "\r" !== i[n] && "  " !== i[n] && 8203 != i[n].charCodeAt(0)) return !1;
    return !0
  }, e.prototype.initEvents = function() { this.mobile() ? (this.mousedown = "touchstart", this.mouseup = "touchend", this.move = "touchmove") : (this.mousedown = "mousedown", this.mouseup = "mouseup", this.move = "") }, e.prototype.initDisable = function() { this.$element.on("keypress keydown keyup", t.proxy(function(t) { return this.isDisabled ? (t.stopPropagation(), t.preventDefault(), !1) : void 0 }, this)) }, e.prototype.continueInit = function() {
    this.initDisable(), this.initEvents(), this.browserFixes(), this.handleEnter(), this.editableDisabled || (this.initUndoRedo(), this.enableTyping(), this.initShortcuts()), this.initTabs(), this.initEditor();
    for (var e = 0; e < t.Editable.initializers.length; e++) t.Editable.initializers[e].call(this);
    this.initOptions(), this.initEditorSelection(), this.initAjaxSaver(), this.setLanguage(), this.setCustomText(), this.editableDisabled || this.registerPaste(), this.refreshDisabledState(), this.refreshUndo(), this.refreshRedo(), this.initPopupSubmit(), this.initialized = !0, this.triggerEvent("initialized", [], !1, !1)
  }, e.prototype.initPopupSubmit = function() {
    this.$popup_editor.find(".froala-popup input").keydown(function(e) {
      var i = e.which;
      13 == i && (e.preventDefault(), e.stopPropagation(), t(this).blur(), t(this).parents(".froala-popup").find("button.f-submit").click())
    })
  }, e.prototype.lateInit = function() { this.saveSelectionByMarkers(), this.continueInit(), this.restoreSelectionByMarkers(), this.$element.focus(), this.hideOtherEditors() }, e.prototype.init = function(e) { this.options.paragraphy || (this.options.defaultTag = "DIV"), this.options.allowStyle && this.setAllowStyle(), this.options.allowScript && this.setAllowScript(), this.initElement(e), this.initElementStyle(), (!this.isLink || this.isImage) && (this.initImageEvents(), this.buildImageMove()), this.options.initOnClick ? (this.editableDisabled || (this.$element.attr("contenteditable", !0), this.$element.attr("spellcheck", !1)), this.$element.bind("mousedown.element focus.element", t.proxy(function(t) { return this.isLink || t.stopPropagation(), this.isDisabled ? !1 : (this.$element.unbind("mousedown.element focus.element"), this.browser.webkit && (this.initMouseUp = !1), void this.lateInit()) }, this))) : this.continueInit() }, e.prototype.phone = function() {
    var t = !1;
    return function(e) {
      (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(e) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(e.substr(0, 4))) && (t = !0)
    }(navigator.userAgent || navigator.vendor || window.opera), t
  }, e.prototype.mobile = function() { return this.phone() || this.android() || this.iOS() || this.blackberry() }, e.prototype.iOS = function() { return /(iPad|iPhone|iPod)/g.test(navigator.userAgent) }, e.prototype.iOSVersion = function() {
    if (/iP(hone|od|ad)/.test(navigator.platform)) {
      var t = navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/),
        e = [parseInt(t[1], 10), parseInt(t[2], 10), parseInt(t[3] || 0, 10)];
      if (e && e[0]) return e[0]
    }
    return 0
  }, e.prototype.iPad = function() { return /(iPad)/g.test(navigator.userAgent) }, e.prototype.iPhone = function() { return /(iPhone)/g.test(navigator.userAgent) }, e.prototype.iPod = function() { return /(iPod)/g.test(navigator.userAgent) }, e.prototype.android = function() { return /(Android)/g.test(navigator.userAgent) }, e.prototype.blackberry = function() { return /(Blackberry)/g.test(navigator.userAgent) }, e.prototype.initOnTextarea = function(e) {
    this.$textarea = t(e), void 0 !== this.$textarea.attr("placeholder") && "Type something" == this.options.placeholder && (this.options.placeholder = this.$textarea.attr("placeholder")), this.$element = t("<div>").html(this.clean(this.$textarea.val(), !0, !1)), this.$element.find("pre br").replaceWith("\n"), this.$textarea.before(this.$element).hide(), this.$textarea.parents("form").bind("submit", t.proxy(function() {
      this.isHTML ? this.html() : this.sync()
    }, this)), this.addListener("destroy", t.proxy(function() { this.$textarea.parents("form").unbind("submit") }, this))
  }, e.prototype.initOnLink = function(e) { this.isLink = !0, this.options.linkText = !0, this.selectionDisabled = !0, this.editableDisabled = !0, this.options.buttons = [], this.$element = t(e), this.options.paragraphy = !1, this.options.countCharacters = !1, this.$box = this.$element }, e.prototype.initOnImage = function(e) { var i = t(e).css("float"); "A" == t(e).parent().get(0).tagName && (e = t(e).parent()), this.isImage = !0, this.editableDisabled = !0, this.imageList = [], this.options.buttons = [], this.options.paragraphy = !1, this.options.imageMargin = "auto", t(e).wrap("<div>"), this.$element = t(e).parent(), this.$element.css("display", "inline-block"), this.$element.css("max-width", "100%"), this.$element.css("margin-left", "auto"), this.$element.css("margin-right", "auto"), this.$element.css("float", i), this.$element.addClass("f-image"), this.$box = t(e) }, e.prototype.initForPopup = function(e) { this.$element = t(e), this.$box = this.$element, this.editableDisabled = !0, this.options.countCharacters = !1, this.options.buttons = [], this.$element.on("click", t.proxy(function(t) { t.preventDefault() }, this)) }, e.prototype.initOnDefault = function(e) { "DIV" != e.tagName && this.options.buttons.indexOf("formatBlock") >= 0 && this.disabledList.push("formatBlock"), this.$element = t(e) }, e.prototype.initElement = function(e) {
    if ("TEXTAREA" == e.tagName ? this.initOnTextarea(e) : "A" == e.tagName ? this.initOnLink(e) : "IMG" == e.tagName ? this.initOnImage(e) : this.options.editInPopup ? this.initForPopup(e) : this.initOnDefault(e), !this.editableDisabled) {
      this.$box = this.$element.addClass("froala-box"), this.$wrapper = t('<div class="froala-wrapper">'), this.$element = t("<div>");
      var i = this.$box.html();
      this.$box.html(this.$wrapper.html(this.$element)), this.$element.on("keyup", t.proxy(function() { this.$element.find("ul, ol").length > 1 && this.cleanupLists() }, this)), this.setHTML(i, !0)
    }
    this.$element.on("drop", t.proxy(function() { setTimeout(t.proxy(function() { t("html").click(), this.$element.find(".f-img-wrap").each(function(e, i) { 0 === t(i).find("img").length && t(i).remove() }), this.$element.find(this.options.defaultTag + ":empty").remove() }, this), 1) }, this))
  }, e.prototype.trim = function(t) { return t = String(t).replace(/^\s+|\s+$/g, ""), t = t.replace(/\u200B/gi, "") }, e.prototype.unwrapText = function() {
    this.options.paragraphy || this.$element.find(this.options.defaultTag).each(t.proxy(function(e, i) {
      if (0 === i.attributes.length) {
        var n = t(i).find("br:last");
        t(i).replaceWith(n.length && this.isLastSibling(n.get(0)) ? t(i).html() : t(i).html() + "<br/>")
      }
    }, this))
  }, e.prototype.wrapTextInElement = function(e, i) {
    void 0 === i && (i = !1);
    var n = [],
      s = ["SPAN", "A", "B", "I", "EM", "U", "S", "STRONG", "STRIKE", "FONT", "IMG", "SUB", "SUP", "BUTTON", "INPUT"],
      o = this;
    this.no_verify = !0;
    var r = function() {
        if (0 === n.length) return !1;
        var e = t("<" + o.options.defaultTag + ">"),
          i = t(n[0]);
        if (1 == n.length && "f-marker" == i.attr("class")) return void(n = []);
        for (var s = 0; s < n.length; s++) {
          var r = t(n[s]);
          e.append(r.clone()), s == n.length - 1 ? r.replaceWith(e) : r.remove()
        }
        n = []
      },
      a = !1,
      l = !1,
      h = !1;
    e.contents().filter(function() { var e = t(this); if (e.hasClass("f-marker") || e.find(".f-marker").length) { var c = e; if (1 == e.find(".f-marker").length || e.hasClass("f-marker")) { c = e.find(".f-marker").length ? t(e.find(".f-marker")[0]) : e; var d = c.prev(); "true" === c.attr("data-type") ? d.length && t(d[0]).hasClass("f-marker") ? h = !0 : (a = !0, l = !1) : l = !0 } else h = !0 } this.nodeType == Node.TEXT_NODE && e.text().length > 0 || s.indexOf(this.tagName) >= 0 ? n.push(this) : this.nodeType == Node.TEXT_NODE && 0 === e.text().length && o.options.beautifyCode ? e.remove() : a || i || h ? ("BR" === this.tagName && (n.length > 0 ? e.remove() : n.push(this)), r(), l && (a = !1), h = !1) : n = [] }), (a || i || h) && r(), e.find("> " + this.options.defaultTag).each(function(e, i) { 0 === t(i).text().trim().length && 0 === t(i).find("img").length && 0 === t(i).find("br").length && t(i).append(this.br) }), e.find("div:empty:not([class])").remove(), e.is(":empty") && e.append(o.options.paragraphy === !0 ? "<" + this.options.defaultTag + ">" + this.br + "</" + this.options.defaultTag + ">" : this.br), this.no_verify = !1
  }, e.prototype.wrapText = function(e) {
    if (this.isImage || this.isLink) return !1;
    this.allow_div = !0, this.removeBlankSpans();
    for (var i = this.getSelectionElements(), n = 0; n < i.length; n++) {
      var s = t(i[n]);
      ["LI", "TH", "TD"].indexOf(s.get(0).tagName) >= 0 ? this.wrapTextInElement(s, !0) : this.parents(s, "li").length ? this.wrapTextInElement(t(this.parents(s, "li")[0]), e) : this.wrapTextInElement(this.$element, e)
    }
    this.allow_div = !1
  }, e.prototype.convertNewLines = function() {
    this.$element.find("pre").each(function(e, i) {
      var n = t(i),
        s = t(i).html();
      s.indexOf("\n") >= 0 && n.html(s.replace(/\n/g, "<br>"))
    })
  }, e.prototype.setHTML = function(e, i) { this.no_verify = !0, this.allow_div = !0, void 0 === i && (i = !0), e = this.clean(e, !0, !1), e = e.replace(/>\s+</g, "><"), this.$element.html(e), this.cleanAttrs(this.$element.get(0)), this.convertNewLines(), this.imageList = [], this.refreshImageList(), this.options.paragraphy && this.wrapText(!0), this.$element.find("li:empty").append(t.Editable.INVISIBLE_SPACE), this.cleanupLists(), this.cleanify(!1, !0, !1), i && (this.restoreSelectionByMarkers(), this.sync()), this.$element.find("span").attr("data-fr-verified", !0), this.initialized && (this.hide(), this.closeImageMode(), this.imageMode = !1), this.no_verify = !1, this.allow_div = !1 }, e.prototype.beforePaste = function() { this.saveSelectionByMarkers(), this.clipboardHTML = null, this.scrollPosition = this.$window.scrollTop(), this.$pasteDiv ? this.$pasteDiv.html("") : (this.$pasteDiv = t('<div contenteditable="true" style="position: fixed; top: 0; left: -9999px; height: 100%; width: 0; z-index: 4000; line-height: 140%;" tabindex="-1"></div>'), this.$box.after(this.$pasteDiv)), this.$pasteDiv.focus(), this.window.setTimeout(t.proxy(this.processPaste, this), 1) }, e.prototype.processPaste = function() {
    var i = this.clipboardHTML;
    null === this.clipboardHTML && (i = this.$pasteDiv.html(), this.restoreSelectionByMarkers(), this.$window.scrollTop(this.scrollPosition));
    var n, s = this.triggerEvent("onPaste", [i], !1);
    "string" == typeof s && (i = s), i = i.replace(/<img /gi, '<img data-fr-image-pasted="true" '), i.match(/(class=\"?Mso|style=\"[^\"]*\bmso\-|w:WordDocument)/gi) ? (n = this.wordClean(i), n = this.clean(t("<div>").append(n).html(), !1, !0), n = this.removeEmptyTags(n)) : (n = this.clean(i, !1, !0), n = this.removeEmptyTags(n), e.copiedText && t("<div>").html(n).text().replace(/\u00A0/gi, " ") == e.copiedText.replace(/(\u00A0|\r|\n)/gi, " ") && (n = e.copiedHTML)), this.options.plainPaste && (n = this.plainPasteClean(n)), s = this.triggerEvent("afterPasteCleanup", [n], !1), "string" == typeof s && (n = s), "" !== n && (this.insertHTML(n, !0, !0), this.saveSelectionByMarkers(), this.removeBlankSpans(), this.$element.find(this.valid_nodes.join(":empty, ") + ":empty").remove(), this.restoreSelectionByMarkers(), this.$element.find("li[data-indent]").each(t.proxy(function(e, i) { this.indentLi ? (t(i).removeAttr("data-indent"), this.indentLi(t(i))) : t(i).removeAttr("data-indent") }, this)), this.$element.find("li").each(t.proxy(function(e, i) { this.wrapTextInElement(t(i), !0) }, this)), this.options.paragraphy && this.wrapText(!0), this.cleanupLists()), this.afterPaste()
  }, e.prototype.afterPaste = function() { this.uploadPastedImages(), this.checkPlaceholder(), this.pasting = !1, this.triggerEvent("afterPaste", [], !0, !1) }, e.prototype.getSelectedHTML = function() {
    function e(e, n) { for (; 3 == n.nodeType || i.valid_nodes.indexOf(n.tagName) < 0;) 3 != n.nodeType && t(e).wrapInner("<" + n.tagName + i.attrs(n) + "></" + n.tagName + ">"), n = n.parentNode }
    var i = this,
      n = "";
    if ("undefined" != typeof window.getSelection)
      for (var s = this.getRanges(), o = 0; o < s.length; o++) {
        var r = document.createElement("div");
        r.appendChild(s[o].cloneContents()), e(r, this.getSelectionParent()), n += r.innerHTML
      } else "undefined" != typeof document.selection && "Text" == document.selection.type && (n = document.selection.createRange().htmlText);
    return n
  }, e.prototype.registerPaste = function() {
    this.$element.on("copy cut", t.proxy(function() { this.isHTML || (e.copiedHTML = this.getSelectedHTML(), e.copiedText = t("<div>").html(e.copiedHTML).text()) }, this)), this.$element.on("paste", t.proxy(function(e) {
      if (!this.isHTML) {
        if (e.originalEvent && (e = e.originalEvent), !this.triggerEvent("beforePaste", [], !1)) return !1;
        if (this.clipboardPaste(e)) return !1;
        this.clipboardHTML = "", this.pasting = !0, this.scrollPosition = this.$window.scrollTop();
        var i = !1;
        if (e && e.clipboardData && e.clipboardData.getData) {
          var n = "",
            s = e.clipboardData.types;
          if (t.Editable.isArray(s))
            for (var o = 0; o < s.length; o++) n += s[o] + ";";
          else n = s;
          if (/text\/html/.test(n) ? this.clipboardHTML = e.clipboardData.getData("text/html") : /text\/rtf/.test(n) && this.browser.safari ? this.clipboardHTML = e.clipboardData.getData("text/rtf") : /text\/plain/.test(n) && !this.browser.mozilla && (this.clipboardHTML = this.escapeEntities(e.clipboardData.getData("text/plain")).replace(/\n/g, "<br/>")), "" !== this.clipboardHTML ? i = !0 : this.clipboardHTML = null, i) return this.processPaste(), e.preventDefault && (e.stopPropagation(), e.preventDefault()), !1
        }
        this.beforePaste()
      }
    }, this))
  }, e.prototype.clipboardPaste = function(e) {
    if (e && e.clipboardData && e.clipboardData.items && e.clipboardData.items[0]) {
      var i = e.clipboardData.items[0].getAsFile();
      if (i) {
        var n = new FileReader;
        return n.onload = t.proxy(function(t) {
          var e = t.target.result;
          this.insertHTML('<img data-fr-image-pasted="true" src="' + e + '" />'), this.afterPaste()
        }, this), n.readAsDataURL(i), !0
      }
    }
    return !1
  }, e.prototype.uploadPastedImages = function() {
    this.options.pasteImage ? this.options.imageUpload && this.$element.find("img[data-fr-image-pasted]").each(t.proxy(function(e, i) {
      if (0 === i.src.indexOf("data:")) {
        if (this.options.defaultImageWidth && t(i).attr("width", this.options.defaultImageWidth), this.options.pastedImagesUploadURL) {
          if (!this.triggerEvent("beforeUploadPastedImage", [i], !1)) return !1;
          setTimeout(t.proxy(function() { this.showImageLoader(), this.$progress_bar.find("span").css("width", "100%").text("Please wait!"), this.showByCoordinates(t(i).offset().left + t(i).width() / 2, t(i).offset().top + t(i).height() + 10), this.isDisabled = !0 }, this), 10), t.ajax({ type: this.options.pastedImagesUploadRequestType, url: this.options.pastedImagesUploadURL, data: t.extend({ image: decodeURIComponent(i.src) }, this.options.imageUploadParams), crossDomain: this.options.crossDomain, xhrFields: { withCredentials: this.options.withCredentials }, headers: this.options.headers, dataType: "json" }).done(t.proxy(function(e) {
            try {
              if (e.link) {
                var n = new Image;
                n.onerror = t.proxy(function() { t(i).remove(), this.hide(), this.throwImageError(1) }, this), n.onload = t.proxy(function() { i.src = e.link, this.hideImageLoader(), this.hide(), this.enable(), setTimeout(function() { t(i).trigger("touchend") }, 50), this.triggerEvent("afterUploadPastedImage", [t(i)]) }, this), n.src = e.link
              } else e.error ? (t(i).remove(), this.hide(), this.throwImageErrorWithMessage(e.error)) : (t(i).remove(), this.hide(), this.throwImageError(2))
            } catch (s) { t(i).remove(), this.hide(), this.throwImageError(4) }
          }, this)).fail(t.proxy(function() { t(i).remove(), this.hide(), this.throwImageError(3) }, this))
        }
      } else 0 !== i.src.indexOf("http") && t(i).remove();
      t(i).removeAttr("data-fr-image-pasted")
    }, this)) : this.$element.find("img[data-fr-image-pasted]").remove()
  }, e.prototype.disable = function() { this.isDisabled = !0, this.$element.blur(), this.$box.addClass("fr-disabled"), this.$element.attr("contenteditable", !1) }, e.prototype.enable = function() { this.isDisabled = !1, this.$box.removeClass("fr-disabled"), this.$element.attr("contenteditable", !0) }, e.prototype.wordClean = function(t) {
    t.indexOf("<body") >= 0 && (t = t.replace(/[.\s\S\w\W<>]*<body[^>]*>([.\s\S\w\W<>]*)<\/body>[.\s\S\w\W<>]*/g, "$1")), t = t.replace(/<p(.*?)class="?'?MsoListParagraph"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<ul><li>$3</li></ul>"), t = t.replace(/<p(.*?)class="?'?NumberedText"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<ol><li>$3</li></ol>"), t = t.replace(/<p(.*?)class="?'?MsoListParagraphCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<ul><li$3>$5</li>"), t = t.replace(/<p(.*?)class="?'?NumberedTextCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<ol><li$3>$5</li>"), t = t.replace(/<p(.*?)class="?'?MsoListParagraphCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<li$3>$5</li>"), t = t.replace(/<p(.*?)class="?'?NumberedTextCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<li$3>$5</li>"), t = t.replace(/<p(.*?)class="?'?MsoListParagraphCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<li$3>$5</li></ul>"), t = t.replace(/<p(.*?)class="?'?NumberedTextCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi, "<li$3>$5</li></ol>"), t = t.replace(/<span([^<]*?)style="?'?mso-list:Ignore"?'?([\s\S]*?)>([\s\S]*?)<span/gi, "<span><span"), t = t.replace(/<!--\[if \!supportLists\]-->([\s\S]*?)<!--\[endif\]-->/gi, ""), t = t.replace(/<!\[if \!supportLists\]>([\s\S]*?)<!\[endif\]>/gi, ""), t = t.replace(/(\n|\r| class=(")?Mso[a-zA-Z0-9]+(")?)/gi, " "), t = t.replace(/<!--[\s\S]*?-->/gi, ""), t = t.replace(/<(\/)*(meta|link|span|\\?xml:|st1:|o:|font)(.*?)>/gi, "");
    for (var e = ["style", "script", "applet", "embed", "noframes", "noscript"], i = 0; i < e.length; i++) {
      var n = new RegExp("<" + e[i] + ".*?" + e[i] + "(.*?)>", "gi");
      t = t.replace(n, "")
    }
    t = t.replace(/&nbsp;/gi, " ");
    var s;
    do s = t, t = t.replace(/<[^\/>][^>]*><\/[^>]+>/gi, ""); while (t != s);
    return t = t.replace(/<lilevel([^1])([^>]*)>/gi, '<li data-indent="true"$2>'), t = t.replace(/<lilevel1([^>]*)>/gi, "<li$1>"), t = this.clean(t), t = t.replace(/<a>(.[^<]+)<\/a>/gi, "$1")
  }, e.prototype.tabs = function(t) { for (var e = "", i = 0; t > i; i++) e += "  "; return e }, e.prototype.cleanTags = function(t, e) {
    void 0 === e && (e = !1);
    var i, n, s, o, r = [],
      a = [],
      l = !1,
      h = !1,
      c = this.options.formatTags;
    for (n = 0; n < t.length; n++)
      if (i = t.charAt(n), "<" == i) {
        var d = t.indexOf(">", n + 1);
        if (-1 !== d) {
          var u = t.substring(n, d + 1),
            p = this.tagName(u);
          if (0 === p.indexOf("!--") && (d = t.indexOf("-->", n + 1), -1 !== d)) { u = t.substring(n, d + 3), a.push(u), n = d + 2; continue }
          if (0 === p.indexOf("!") && a.length && a[a.length - 1] != u) { a.push(u), n = d; continue }
          if ("head" == p && this.options.fullPage && (h = !0), h) { a.push(u), n = d, "head" == p && this.isClosingTag(u) && (h = !1); continue }
          if (this.options.allowedTags.indexOf(p) < 0 && (!this.options.fullPage || ["html", "head", "body", "!doctype"].indexOf(p) < 0)) { n = d; continue }
          var f = this.isClosingTag(u);
          if ("pre" === p && (l = f ? !1 : !0), this.isSelfClosingTag(u)) a.push("br" === p && l ? "\n" : u);
          else if (f)
            for (s = !1, o = !0; s === !1 && void 0 !== o;) o = r.pop(), void 0 !== o && o.tag_name !== p ? a.splice(o.i, 1) : (s = !0, void 0 !== o && a.push(u));
          else a.push(u), r.push({ tag_name: p, i: a.length - 1 });
          n = d
        }
      } else "\n" === i && this.options.beautifyCode ? e && l ? a.push("<br/>") : l ? a.push(i) : r.length > 0 && a.push(" ") : 9 != i.charCodeAt(0) && a.push(i);
    for (; r.length > 0;) o = r.pop(), a.splice(o.i, 1);
    var m = "\n";
    this.options.beautifyCode || (m = ""), t = "", r = 0;
    var g = !0;
    for (n = 0; n < a.length; n++) 1 == a[n].length ? g && " " === a[n] || (t += a[n], g = !1) : c.indexOf(this.tagName(a[n]).toLowerCase()) < 0 ? (t += a[n], "br" == this.tagName(a[n]) && (t += m)) : this.isSelfClosingTag(a[n]) ? c.indexOf(this.tagName(a[n]).toLowerCase()) >= 0 ? (t += this.tabs(r) + a[n] + m, g = !1) : t += a[n] : this.isClosingTag(a[n]) ? (r -= 1, 0 === r && (g = !0), t.length > 0 && t[t.length - 1] == m && (t += this.tabs(r)), t += a[n] + m) : (t += m + this.tabs(r) + a[n], r += 1, g = !1);
    return t[0] == m && (t = t.substring(1, t.length)), t[t.length - 1] == m && (t = t.substring(0, t.length - 1)), t
  }, e.prototype.cleanupLists = function() {
    this.$element.find("ul, ol").each(t.proxy(function(e, i) {
      var n = t(i);
      if (this.parents(t(i), "ul, ol").length > 0) return !0;
      if (n.find(".close-ul, .open-ul, .close-ol, .open-ol, .open-li, .close-li").length > 0) {
        var s = "<" + i.tagName.toLowerCase() + ">" + n.html() + "</" + i.tagName.toLowerCase() + ">";
        s = s.replace(new RegExp('<span class="close-ul" data-fr-verified="true"></span>', "g"), "</ul>"), s = s.replace(new RegExp('<span class="open-ul" data-fr-verified="true"></span>', "g"), "<ul>"), s = s.replace(new RegExp('<span class="close-ol" data-fr-verified="true"></span>', "g"), "</ol>"), s = s.replace(new RegExp('<span class="open-ol" data-fr-verified="true"></span>', "g"), "<ol>"), s = s.replace(new RegExp('<span class="close-li" data-fr-verified="true"></span>', "g"), "</li>"), s = s.replace(new RegExp('<span class="open-li" data-fr-verified="true"></span>', "g"), "<li>"), s = s.replace(new RegExp("<li></li>", "g"), ""), n.replaceWith(s)
      }
    }, this)), this.$element.find("li > td").remove(), this.$element.find("li td:empty").append(t.Editable.INVISIBLE_SPACE), this.$element.find(" > li").wrap("<ul>"), this.$element.find("ul, ol").each(t.proxy(function(e, i) {
      var n = t(i);
      0 === n.find(this.valid_nodes.join(",")).length && n.remove()
    }, this)), this.$element.find("li > ul, li > ol").each(t.proxy(function(e, i) {
      var n = t(i).parent().get(0).previousSibling;
      this.isFirstSibling(i) && (n && "LI" == n.tagName ? t(n).append(t(i)) : t(i).before("<br/>"))
    }, this)), this.$element.find("li:empty").remove();
    for (var e = this.$element.find("ol + ol, ul + ul"), i = 0; i < e.length; i++) {
      var n = t(e[i]);
      this.attrs(e[i]) == this.attrs(n.prev().get(0)) && (n.prev().append(n.html()), n.remove())
    }
    this.$element.find("li > td").remove(), this.$element.find("li td:empty").append(t.Editable.INVISIBLE_SPACE), this.$element.find("li > " + this.options.defaultTag).each(function(e, i) { 0 === i.attributes.length && t(i).replaceWith(t(i).html()) })
  }, e.prototype.escapeEntities = function(t) { return t.replace(/</gi, "&lt;").replace(/>/gi, "&gt;").replace(/"/gi, "&quot;").replace(/'/gi, "&apos;") }, e.prototype.cleanNodeAttrs = function(t, e) {
    var i = t.attributes;
    if (i)
      for (var n = new RegExp("^" + e.join("$|^") + "$", "i"), s = 0; s < i.length; s++) {
        var o = i[s];
        n.test(o.nodeName) ? t.setAttribute(o.nodeName, o.nodeValue.replace(/</gi, "&lt;").replace(/>/gi, "&gt;")) : t.removeAttribute(o.nodeName)
      }
  }, e.prototype.cleanAttrs = function(t) { 1 == t.nodeType && t.className.indexOf("f-marker") < 0 && t !== this.$element.get(0) && "IFRAME" != t.tagName && this.cleanNodeAttrs(t, this.options.allowedAttrs, !0); for (var e = t.childNodes, i = 0; i < e.length; i++) this.cleanAttrs(e[i]) }, e.prototype.clean = function(i, n, s, o, r) {
    this.pasting && e.copiedText === t("<div>").html(i).text() && (s = !1, n = !0), r || (r = t.merge([], this.options.allowedAttrs)), o || (o = t.merge([], this.options.allowedTags)), n || r.indexOf("id") > -1 && r.splice(r.indexOf("id"), 1), this.options.fullPage && (i = i.replace(/<!DOCTYPE([^>]*?)>/i, "<!-- DOCTYPE$1 -->"), i = i.replace(/<html([^>]*?)>/i, "<!-- html$1 -->"), i = i.replace(/<\/html([^>]*?)>/i, "<!-- /html$1 -->"), i = i.replace(/<body([^>]*?)>/i, "<!-- body$1 -->"), i = i.replace(/<\/body([^>]*?)>/i, "<!-- /body$1 -->"), i = i.replace(/<head>([\w\W]*)<\/head>/i, function(t, e) { var i = 1; return e = e.replace(/(<style)/gi, function(t, e) { return e + " data-id=" + i++ }), "<!-- head " + e.replace(/(>)([\s|\t]*)(<)/gi, "$1$3").replace(/</gi, "[").replace(/>/gi, "]") + " -->" })), this.options.allowComments ? (this.options.allowedTags.push("!--"), this.options.allowedTags.push("!")) : i = i.replace(/(<!--[.\s\w\W]*?-->)/gi, ""), this.options.allowScript || (i = i.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")), this.options.allowStyle || (i = i.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")), i = i.replace(/<!--([.\s\w\W]*?)-->/gi, function(t, e) { return "<!--" + e.replace(/</g, "[[").replace(/>/g, "]]") + "-->" });
    var a = new RegExp("<\\/?((?!(?:" + o.join(" |") + " |" + o.join(">|") + ">|" + o.join("/>|") + "/>))\\w+)[^>]*?>", "gi");
    if (i = i.replace(a, ""), i = i.replace(/<!--([.\s\w\W]*?)-->/gi, function(t, e) { return "<!--" + e.replace(/\[\[/g, "<").replace(/\]\]/g, ">") + "-->" }), s) {
      var l = new RegExp("style=(\"[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/'%]*\"|'[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/\"%]*')", "gi");
      i = i.replace(l, ""), i = i.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    }
    i = this.cleanTags(i, !0), i = i.replace(/(\r|\n)/gi, "");
    var h = new RegExp("<([^>]*)( src| href)=('[^']*'|\"[^\"]*\"|[^\\s>]+)([^>]*)>", "gi");
    if (i = i.replace(h, t.proxy(function(t, e, i, n, s) { return "<" + e + i + '="' + this.sanitizeURL(n.replace(/^["'](.*)["']\/?$/gi, "$1")) + '"' + s + ">" }, this)), !n) {
      var c = t("<div>").append(i);
      c.find('[class]:not([class^="fr-"])').each(function(e, i) { t(i).removeAttr("class") }), i = c.html()
    }
    return i
  }, e.prototype.removeBlankSpans = function() { this.no_verify = !0, this.$element.find("span").removeAttr("data-fr-verified"), this.$element.find("span").each(t.proxy(function(e, i) { 0 === this.attrs(i).length && t(i).replaceWith(t(i).html()) }, this)), this.$element.find("span").attr("data-fr-verified", !0), this.no_verify = !1 }, e.prototype.plainPasteClean = function(e) {
    var i = t("<div>").html(e);
    i.find("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote").each(t.proxy(function(e, i) { t(i).replaceWith("<" + this.options.defaultTag + ">" + t(i).html() + "</" + this.options.defaultTag + ">") }, this)), t(i.find("*").not("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol, li, table, tbody, thead, tr, td, br").get().reverse()).each(function() { t(this).replaceWith(t(this).html()) });
    var n = function(e) { for (var i = e.contents(), s = 0; s < i.length; s++) 3 != i[s].nodeType && 1 != i[s].nodeType ? t(i[s]).remove() : n(t(i[s])) };
    return n(i), i.html()
  }, e.prototype.removeEmptyTags = function(e) {
    for (var i, n = t("<div>").html(e), s = n.find("*:empty:not(br, img, td, th)"); s.length;) {
      for (i = 0; i < s.length; i++) t(s[i]).remove();
      s = n.find("*:empty:not(br, img, td, th)")
    }
    for (var o = n.find("> div, td > div, th > div, li > div"); o.length;) {
      var r = t(o[o.length - 1]);
      r.replaceWith(r.html() + "<br/>"), o = n.find("> div, td > div, th > div, li > div")
    }
    for (o = n.find("div"); o.length;) {
      for (i = 0; i < o.length; i++) {
        var a = t(o[i]),
          l = a.html().replace(/\u0009/gi, "").trim();
        a.replaceWith(l)
      }
      o = n.find("div")
    }
    return n.html()
  }, e.prototype.initElementStyle = function() {
    this.editableDisabled || this.$element.attr("contenteditable", !0);
    var t = "froala-view froala-element " + this.options.editorClass;
    this.browser.msie && e.getIEversion() < 9 && (t += " ie8"), this.$element.css("outline", 0), this.browser.msie || (t += " not-msie"), this.$element.addClass(t)
  }, e.prototype.CJKclean = function(t) { var e = /[\u3041-\u3096\u30A0-\u30FF\u4E00-\u9FFF\u3130-\u318F\uAC00-\uD7AF]/gi; return t.replace(e, "") }, e.prototype.enableTyping = function() {
    this.typingTimer = null, this.$element.on("keydown", "textarea, input", function(t) { t.stopPropagation() }), this.$element.on("keydown cut", t.proxy(function(e) {
      if (!this.isHTML) {
        if (!this.options.multiLine && 13 == e.which) return e.preventDefault(), e.stopPropagation(), !1;
        if ("keydown" === e.type && !this.triggerEvent("keydown", [e], !1)) return !1;
        clearTimeout(this.typingTimer), this.ajaxSave = !1, this.oldHTML = this.getHTML(!0, !1), this.typingTimer = setTimeout(t.proxy(function() {
          var t = this.getHTML(!0, !1);
          this.ime || this.CJKclean(t) === this.CJKclean(this.oldHTML) || this.CJKclean(t) !== t || this.sync()
        }, this), Math.max(this.options.typingTimer, 500))
      }
    }, this))
  }, e.prototype.removeMarkersByRegex = function(t) { return t.replace(/<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>([\S\s][^\/])*<\/span>/gi, "") }, e.prototype.getImageHTML = function() { return JSON.stringify({ src: this.$element.find("img").attr("src"), style: this.$element.find("img").attr("style"), alt: this.$element.find("img").attr("alt"), width: this.$element.find("img").attr("width"), link: this.$element.find("a").attr("href"), link_title: this.$element.find("a").attr("title"), link_target: this.$element.find("a").attr("target") }) }, e.prototype.getLinkHTML = function() { return JSON.stringify({ body: this.$element.html(), href: this.$element.attr("href"), title: this.$element.attr("title"), popout: this.$element.hasClass("popout"), nofollow: "nofollow" == this.$element.attr("ref"), blank: "_blank" == this.$element.attr("target"), cls: this.$element.attr("class") ? this.$element.attr("class").replace(/froala-element ?|not-msie ?|froala-view ?/gi, "").trim() : "" }) }, e.prototype.addFrTag = function() { this.$element.find(this.valid_nodes.join(",") + ", table, ul, ol, img").addClass("fr-tag") }, e.prototype.removeFrTag = function() { this.$element.find(this.valid_nodes.join(",") + ", table, ul, ol, img").removeClass("fr-tag") }, e.prototype.getHTML = function(e, i, n) {
    if (void 0 === e && (e = !1), void 0 === i && (i = this.options.useFrTag), void 0 === n && (n = !0), this.$element.hasClass("f-placeholder") && !e) return "";
    if (this.isHTML) return this.$html_area.val();
    if (this.isImage) return this.getImageHTML();
    if (this.isLink) return this.getLinkHTML();
    this.$element.find("a").data("fr-link", !0), i && this.addFrTag(), this.$element.find(".f-img-editor > img").each(t.proxy(function(e, i) { t(i).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(t(i).parent().attr("class"))) }, this)), this.options.useClasses || this.$element.find("img").each(t.proxy(function(e, i) {
      var n = t(i);
      n.attr("data-style", this.getImageStyle(n))
    }, this)), this.$element.find("pre").each(t.proxy(function(e, i) {
      var n = t(i),
        s = n.html(),
        o = s.replace(/\&nbsp;/gi, " ").replace(/\n/gi, "<br>");
      s != o && (this.saveSelectionByMarkers(), n.html(o), this.restoreSelectionByMarkers())
    }, this)), this.$element.find("pre br").addClass("fr-br"), this.$element.find('[class=""]').removeAttr("class"), this.cleanAttrs(this.$element.get(0));
    var s = this.$element.html();
    this.removeFrTag(), this.$element.find("pre br").removeAttr("class"), s = s.replace(/<a[^>]*?><\/a>/g, ""), e || (s = this.removeMarkersByRegex(s)), s = s.replace(/<span[^>]*? class\s*=\s*["']?f-img-handle[^>]+><\/span>/gi, ""), s = s.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-editor[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi, "$1$2$3"), s = s.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-wrap[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi, "$1$2$3"), this.options.useClasses || (s = s.replace(/data-style/gi, "style"), s = s.replace(/(<img[^>]*)( class\s*=['"]?[a-zA-Z0-9- ]+['"]?)([^>]*\/?>)/gi, "$1$3")), this.options.simpleAmpersand && (s = s.replace(/\&amp;/gi, "&")), n && (s = s.replace(/ data-fr-verified="true"/gi, "")), this.options.beautifyCode && (s = s.replace(/\n/gi, "")), s = s.replace(/<br class="fr-br">/gi, "\n"), s = s.replace(/\u200B/gi, ""), this.options.fullPage && (s = s.replace(/<!-- DOCTYPE([^>]*?) -->/i, "<!DOCTYPE$1>"), s = s.replace(/<!-- html([^>]*?) -->/i, "<html$1>"), s = s.replace(/<!-- \/html([^>]*?) -->/i, "</html$1>"), s = s.replace(/<!-- body([^>]*?) -->/i, "<body$1>"), s = s.replace(/<!-- \/body([^>]*?) -->/i, "</body$1>"), s = s.replace(/<!-- head ([\w\W]*?) -->/i, function(t, e) { return "<head>" + e.replace(/\[/gi, "<").replace(/\]/gi, ">") + "</head>" }));
    var o = this.triggerEvent("getHTML", [s], !1);
    return "string" == typeof o ? o : s
  }, e.prototype.getText = function() { return this.$element.text() }, e.prototype.setDirty = function(t) { this.dirty = t, t || (clearTimeout(this.ajaxInterval), this.ajaxHTML = this.getHTML(!1, !1)) }, e.prototype.initAjaxSaver = function() {
    this.ajaxHTML = this.getHTML(!1, !1), this.ajaxSave = !0, this.ajaxInterval = setInterval(t.proxy(function() {
      var t = this.getHTML(!1, !1);
      (this.ajaxHTML != t || this.dirty) && this.ajaxSave && (this.options.autosave && this.save(), this.dirty = !1, this.ajaxHTML = t), this.ajaxSave = !0
    }, this), Math.max(this.options.autosaveInterval, 100))
  }, e.prototype.disableBrowserUndo = function() {
    this.$element.keydown(t.proxy(function(t) {
      var e = t.which,
        i = (t.ctrlKey || t.metaKey) && !t.altKey;
      if (!this.isHTML && i) { if (90 == e && t.shiftKey) return t.preventDefault(), !1; if (90 == e) return t.preventDefault(), !1 }
    }, this))
  }, e.prototype.shortcutEnabled = function(t) { return this.options.shortcutsAvailable.indexOf(t) >= 0 }, e.prototype.shortcuts_map = { 69: { cmd: "show", params: [null], id: "show" }, 66: { cmd: "exec", params: ["bold"], id: "bold" }, 73: { cmd: "exec", params: ["italic"], id: "italic" }, 85: { cmd: "exec", params: ["underline"], id: "underline" }, 83: { cmd: "exec", params: ["strikeThrough"], id: "strikeThrough" }, 75: { cmd: "exec", params: ["createLink"], id: "createLink" }, 80: { cmd: "exec", params: ["insertImage"], id: "insertImage" }, 221: { cmd: "exec", params: ["indent"], id: "indent" }, 219: { cmd: "exec", params: ["outdent"], id: "outdent" }, 72: { cmd: "exec", params: ["html"], id: "html" }, 48: { cmd: "exec", params: ["formatBlock", "n"], id: "formatBlock n" }, 49: { cmd: "exec", params: ["formatBlock", "h1"], id: "formatBlock h1" }, 50: { cmd: "exec", params: ["formatBlock", "h2"], id: "formatBlock h2" }, 51: { cmd: "exec", params: ["formatBlock", "h3"], id: "formatBlock h3" }, 52: { cmd: "exec", params: ["formatBlock", "h4"], id: "formatBlock h4" }, 53: { cmd: "exec", params: ["formatBlock", "h5"], id: "formatBlock h5" }, 54: { cmd: "exec", params: ["formatBlock", "h6"], id: "formatBlock h6" }, 222: { cmd: "exec", params: ["formatBlock", "blockquote"], id: "formatBlock blockquote" }, 220: { cmd: "exec", params: ["formatBlock", "pre"], id: "formatBlock pre" } }, e.prototype.ctrlKey = function(t) { if (-1 != navigator.userAgent.indexOf("Mac OS X")) { if (t.metaKey && !t.altKey) return !0 } else if (t.ctrlKey && !t.altKey) return !0; return !1 }, e.prototype.initShortcuts = function() {
    this.options.shortcuts && this.$element.on("keydown", t.proxy(function(t) {
      var e = t.which,
        i = this.ctrlKey(t);
      if (!this.isHTML && i) { if (this.shortcuts_map[e] && this.shortcutEnabled(this.shortcuts_map[e].id)) return this.execDefaultShortcut(this.shortcuts_map[e].cmd, this.shortcuts_map[e].params); if (90 == e && t.shiftKey) return t.preventDefault(), t.stopPropagation(), this.redo(), !1; if (90 == e) return t.preventDefault(), t.stopPropagation(), this.undo(), !1 }
    }, this))
  }, e.prototype.initTabs = function() {
    this.$element.on("keydown", t.proxy(function(t) {
      var e = t.which;
      if (9 != e || t.shiftKey) 9 == e && t.shiftKey && (this.raiseEvent("shift+tab") ? this.options.tabSpaces ? t.preventDefault() : this.blur() : t.preventDefault());
      else if (this.raiseEvent("tab"))
        if (this.options.tabSpaces) {
          t.preventDefault();
          var i = "&nbsp;&nbsp;&nbsp;&nbsp;",
            n = this.getSelectionElements()[0];
          "PRE" === n.tagName && (i = "    "), this.insertHTML(i, !1)
        } else this.blur();
      else t.preventDefault()
    }, this))
  }, e.prototype.textEmpty = function(e) { var i = t(e).text().replace(/(\r\n|\n|\r|\t)/gm, ""); return ("" === i || e === this.$element.get(0)) && 0 === t(e).find("br").length }, e.prototype.inEditor = function(t) {
    for (; t && "BODY" !== t.tagName;) {
      if (t === this.$element.get(0)) return !0;
      t = t.parentNode
    }
    return !1
  }, e.prototype.focus = function(e) {
    if (this.isDisabled) return !1;
    if (void 0 === e && (e = !0), "" !== this.text() && !this.$element.is(":focus")) return void(this.browser.msie || (this.clearSelection(), this.$element.focus()));
    if (!this.isHTML) {
      if (e && !this.pasting && this.$element.focus(), this.pasting && !this.$element.is(":focus") && this.$element.focus(), this.$element.hasClass("f-placeholder")) return void this.setSelection(this.$element.find(this.options.defaultTag).length > 0 ? this.$element.find(this.options.defaultTag)[0] : this.$element.get(0));
      var i = this.getRange();
      if ("" === this.text() && i && (0 === i.startOffset || i.startContainer === this.$element.get(0) || !this.inEditor(i.startContainer))) {
        var n, s, o = this.getSelectionElements();
        if (t.merge(["IMG", "BR"], this.valid_nodes).indexOf(this.getSelectionElement().tagName) < 0) return !1;
        if (i.startOffset > 0 && this.valid_nodes.indexOf(this.getSelectionElement().tagName) >= 0 && "BODY" != i.startContainer.tagName || i.startContainer && 3 === i.startContainer.nodeType) return;
        if (!this.options.paragraphy && o.length >= 1 && o[0] === this.$element.get(0)) {
          var r = function(e) { if (!e) return null; if (3 == e.nodeType && e.textContent.length > 0) return e; if (1 == e.nodeType && "BR" == e.tagName) return e; for (var i = t(e).contents(), n = 0; n < i.length; n++) { var s = r(i[n]); if (null != s) return s } return null };
          if (0 === i.startOffset && this.$element.contents().length > 0 && 3 != this.$element.contents()[0].nodeType) {
            var a = r(this.$element.get(0));
            null != a && ("BR" == a.tagName ? this.$element.is(":focus") && (t(a).before(this.markers_html), this.restoreSelectionByMarkers()) : this.setSelection(a))
          }
          return !1
        }
        if (o.length >= 1 && o[0] !== this.$element.get(0))
          for (n = 0; n < o.length; n++) { if (s = o[n], !this.textEmpty(s) || this.browser.msie) return void this.setSelection(s); if (this.textEmpty(s) && ["LI", "TD"].indexOf(s.tagName) >= 0) return }
        if (i.startContainer === this.$element.get(0) && i.startOffset > 0 && !this.options.paragraphy) return void this.setSelection(this.$element.get(0), i.startOffset);
        for (o = this.$element.find(this.valid_nodes.join(",")), n = 0; n < o.length; n++)
          if (s = o[n], !this.textEmpty(s) && 0 === t(s).find(this.valid_nodes.join(",")).length) return void this.setSelection(s);
        this.setSelection(this.$element.get(0))
      }
    }
  }, e.prototype.addMarkersAtEnd = function(e) {
    if (e.find(".fr-marker").length > 0) return !1;
    for (var i = e.get(0), n = t(i).contents(); n.length && this.valid_nodes.indexOf(n[n.length - 1].tagName) >= 0;) i = n[n.length - 1], n = t(n[n.length - 1]).contents();
    t(i).append(this.markers_html)
  }, e.prototype.setFocusAtEnd = function(t) { void 0 === t && (t = this.$element), this.addMarkersAtEnd(t), this.restoreSelectionByMarkers() }, e.prototype.breakHTML = function(e, i) {
    "undefined" == typeof i && (i = !0), this.removeMarkers(), 0 === this.$element.find("break").length && this.insertSimpleHTML("<break></break>");
    var n = this.parents(this.$element.find("break"), t.merge(["UL", "OL"], this.valid_nodes).join(","))[0];
    if (this.parents(t(n), "ul, ol").length && (n = this.parents(t(n), "ul, ol")[0]), void 0 === n && (n = this.$element.get(0)), ["UL", "OL"].indexOf(n.tagName) >= 0) {
      var s = t("<div>").html(e);
      s.find("> li").wrap("<" + n.tagName + ">"), e = s.html()
    }
    if (n == this.$element.get(0)) {
      if (this.$element.find("break").next().length) {
        this.insertSimpleHTML('<div id="inserted-div">' + e + "</div>");
        var o = this.$element.find("div#inserted-div");
        this.setFocusAtEnd(o), this.saveSelectionByMarkers(), o.replaceWith(o.contents()), this.restoreSelectionByMarkers()
      } else this.insertSimpleHTML(e), this.setFocusAtEnd();
      return this.$element.find("break").remove(), this.checkPlaceholder(), !0
    }
    if ("TD" === n.tagName) return this.$element.find("break").remove(), this.insertSimpleHTML(e), !0;
    var r = t("<div>").html(e);
    if (this.addMarkersAtEnd(r), e = r.html(), this.emptyElement(t(n))) return t(n).replaceWith(e), this.restoreSelectionByMarkers(), this.checkPlaceholder(), !0;
    this.$element.find("li").each(t.proxy(function(e, i) { this.emptyElement(i) && t(i).addClass("empty-li") }, this));
    for (var a, l, h = t("<div></div>").append(t(n).clone()).html(), c = [], d = {}, u = [], p = 0, f = 0; f < h.length; f++)
      if (l = h.charAt(f), "<" == l) {
        var m = h.indexOf(">", f + 1);
        if (-1 !== m) {
          a = h.substring(f, m + 1);
          var g = this.tagName(a);
          if (f = m, "break" == g) { if (!this.isClosingTag(a)) { for (var v = !0, y = [], b = c.length - 1; b >= 0; b--) { var w = this.tagName(c[b]); if (!i && "LI" == w.toUpperCase()) { v = !1; break } u.push("</" + w + ">"), y.push(c[b]) } u.push(e), v || u.push("</li><li>"); for (var _ = 0; _ < y.length; _++) u.push(y[_]) } } else if (u.push(a), !this.isSelfClosingTag(a))
            if (this.isClosingTag(a)) {
              var x = d[g].pop();
              c.splice(x, 1)
            } else c.push(a), void 0 === d[g] && (d[g] = []), d[g].push(c.length - 1)
        }
      } else p++, u.push(l);
    t(n).replaceWith(u.join("")), this.$element.find("li").each(t.proxy(function(e, i) {
      var n = t(i);
      n.hasClass("empty-li") ? n.removeClass("empty-li") : this.emptyElement(i) && n.remove()
    }, this)), this.cleanupLists(), this.restoreSelectionByMarkers()
  }, e.prototype.insertSimpleHTML = function(t) {
    var e, i;
    if (this.no_verify = !0, this.window.getSelection) {
      if (e = this.window.getSelection(), e.getRangeAt && e.rangeCount) {
        i = e.getRangeAt(0), this.browser.webkit ? i.collapsed || this.document.execCommand("delete") : i.deleteContents(), this.$element.find(this.valid_nodes.join(":empty, ") + ":empty").remove();
        var n = this.document.createElement("div");
        n.innerHTML = t;
        for (var s, o, r = this.document.createDocumentFragment(); s = n.firstChild;) o = r.appendChild(s);
        i.insertNode(r), o && (i = i.cloneRange(), i.setStartAfter(o), i.collapse(!0), e.removeAllRanges(), e.addRange(i))
      }
    } else if ((e = this.document.selection) && "Control" != e.type) {
      var a = e.createRange();
      a.collapse(!0), e.createRange().pasteHTML(t)
    }
    this.no_verify = !1
  }, e.prototype.insertHTML = function(e, i, n) {
    if (void 0 === i && (i = !0), void 0 === n && (n = !1), !this.isHTML && i && this.focus(), this.removeMarkers(), this.insertSimpleHTML("<break></break>"), this.checkPlaceholder(!0), this.$element.hasClass("f-placeholder")) return this.$element.html(e), this.options.paragraphy && this.wrapText(!0), this.$element.find("p > br").each(function() {
      var e = this.parentNode;
      1 == t(e).contents().length && t(e).remove()
    }), this.$element.find("break").remove(), this.setFocusAtEnd(), this.checkPlaceholder(), this.convertNewLines(), !1;
    for (var s = t("<div>").append(e).find("*"), o = 0; o < s.length; o++)
      if (this.valid_nodes.indexOf(s[o].tagName) >= 0) return this.breakHTML(e), this.$element.find("break").remove(), this.convertNewLines(), !1;
    this.$element.find("break").remove(), this.insertSimpleHTML(e), this.convertNewLines()
  }, e.prototype.execDefaultShortcut = function(t, e) { return this[t].apply(this, e), !1 }, e.prototype.initEditor = function() {
    var i = "froala-editor";
    this.mobile() && (i += " touch"), this.browser.msie && e.getIEversion() < 9 && (i += " ie8"), this.$editor = t('<div class="' + i + '" style="display: none;">');
    var n = this.$document.find(this.options.scrollableContainer);
    n.append(this.$editor), this.options.inlineMode ? this.initInlineEditor() : this.initBasicEditor()
  }, e.prototype.refreshToolbarPosition = function() { this.$window.scrollTop() > this.$box.offset().top && this.$window.scrollTop() < this.$box.offset().top + this.$box.outerHeight() - this.$editor.outerHeight() ? (this.$element.css("padding-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$placeholder.css("margin-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom", "").css("left", this.$box.offset().left + parseFloat(this.$box.css("padding-left"), 10) - this.$window.scrollLeft()).width(this.$box.width() - parseFloat(this.$editor.css("border-left-width"), 10) - parseFloat(this.$editor.css("border-right-width"), 10)), this.iOS() && (this.$element.is(":focus") ? this.$editor.css("top", this.$window.scrollTop()) : this.$editor.css("top", ""))) : this.$window.scrollTop() < this.$box.offset().top ? this.iOS() && this.$element.is(":focus") ? (this.$element.css("padding-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$placeholder.css("margin-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom", "").css("left", this.$box.offset().left + parseFloat(this.$box.css("padding-left"), 10) - this.$window.scrollLeft()).width(this.$box.width() - parseFloat(this.$editor.css("border-left-width"), 10) - parseFloat(this.$editor.css("border-right-width"), 10)), this.$editor.css("top", this.$box.offset().top)) : (this.$editor.removeClass("f-scroll f-scroll-abs").css("bottom", "").css("top", "").width(""), this.$element.css("padding-top", ""), this.$placeholder.css("margin-top", "")) : this.$window.scrollTop() > this.$box.offset().top + this.$box.outerHeight() - this.$editor.outerHeight() && !this.$editor.hasClass("f-scroll-abs") ? (this.$element.css("padding-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$placeholder.css("margin-top", this.$editor.outerHeight() + this.$element.data("padding-top")), this.$editor.removeClass("f-scroll").addClass("f-scroll-abs"), this.$editor.css("bottom", 0).css("top", "").css("left", "")) : this.$editor.removeClass("f-scroll").css("bottom", "").css("top", "").css("left", "").width("") }, e.prototype.toolbarTop = function() { this.options.toolbarFixed || this.options.inlineMode || (this.$element.data("padding-top", parseInt(this.$element.css("padding-top"), 10)), this.$window.on("scroll resize load", t.proxy(function() { this.refreshToolbarPosition() }, this)), this.iOS() && this.$element.on("focus blur", t.proxy(function() { this.refreshToolbarPosition() }, this))) }, e.prototype.initBasicEditor = function() {
    this.$element.addClass("f-basic"), this.$wrapper.addClass("f-basic"), this.$popup_editor = this.$editor.clone();
    var t = this.$document.find(this.options.scrollableContainer);
    this.$popup_editor.appendTo(t).addClass("f-inline"), this.$editor.addClass("f-basic").show(), this.$editor.insertBefore(this.$wrapper), this.toolbarTop()
  }, e.prototype.initInlineEditor = function() { this.$editor.addClass("f-inline"), this.$element.addClass("f-inline"), this.$popup_editor = this.$editor }, e.prototype.initDrag = function() { this.drag_support = { filereader: "undefined" != typeof FileReader, formdata: !!this.window.FormData, progress: "upload" in new XMLHttpRequest } }, e.prototype.initOptions = function() { this.setDimensions(), this.setSpellcheck(), this.setImageUploadURL(), this.setButtons(), this.setDirection(), this.setZIndex(), this.setTheme(), this.options.editInPopup && this.buildEditPopup(), this.editableDisabled || (this.setPlaceholder(), this.setPlaceholderEvents()) }, e.prototype.setAllowStyle = function(t) { "undefined" == typeof t && (t = this.options.allowStyle), t ? this.options.allowedTags.push("style") : this.options.allowedTags.splice(this.options.allowedTags.indexOf("style"), 1) }, e.prototype.setAllowScript = function(t) { "undefined" == typeof t && (t = this.options.allowScript), t ? this.options.allowedTags.push("script") : this.options.allowedTags.splice(this.options.allowedTags.indexOf("script"), 1) }, e.prototype.isTouch = function() { return WYSIWYGModernizr.touch && void 0 !== this.window.Touch }, e.prototype.initEditorSelection = function() {
    this.$element.on("keyup", t.proxy(function(t) { return this.triggerEvent("keyup", [t], !1) }, this)), this.$element.on("focus", t.proxy(function() { this.blurred && (this.blurred = !1, this.pasting || "" !== this.text() || this.focus(!1), this.triggerEvent("focus", [], !1)) }, this)), this.$element.on("mousedown touchstart", t.proxy(function() { return this.isDisabled ? !1 : void(this.isResizing() || (this.closeImageMode(), this.hide())) }, this)), this.options.disableRightClick && this.$element.contextmenu(t.proxy(function(t) { return t.preventDefault(), this.options.inlineMode && this.$element.focus(), !1 }, this)), this.$element.on(this.mouseup, t.proxy(function(e) {
      if (this.isDisabled) return !1;
      if (!this.isResizing()) {
        var i = this.text();
        e.stopPropagation(), this.imageMode = !1, !("" !== i || this.options.alwaysVisible || this.options.editInPopup || (3 == e.which || 2 == e.button) && this.options.inlineMode && !this.isImage && this.options.disableRightClick) || this.link || this.imageMode ? this.options.inlineMode || this.refreshButtons() : setTimeout(t.proxy(function() { i = this.text(), !("" !== i || this.options.alwaysVisible || this.options.editInPopup || (3 == e.which || 2 == e.button) && this.options.inlineMode && !this.isImage && this.options.disableRightClick) || this.link || this.imageMode || (this.show(e), this.options.editInPopup && this.showEditPopup()) }, this), 0)
      }
      this.hideDropdowns(), this.hideOtherEditors()
    }, this)), this.$editor.on(this.mouseup, t.proxy(function(t) { return this.isDisabled ? !1 : void(this.isResizing() || (t.stopPropagation(), this.options.inlineMode === !1 && this.hide())) }, this)), this.$editor.on("mousedown", ".fr-dropdown-menu", t.proxy(function(t) { return this.isDisabled ? !1 : (t.stopPropagation(), void(this.noHide = !0)) }, this)), this.$popup_editor.on("mousedown", ".fr-dropdown-menu", t.proxy(function(t) { return this.isDisabled ? !1 : (t.stopPropagation(), void(this.noHide = !0)) }, this)), this.$popup_editor.on("mouseup", t.proxy(function(t) { return this.isDisabled ? !1 : void(this.isResizing() || t.stopPropagation()) }, this)), this.$edit_popup_wrapper && this.$edit_popup_wrapper.on("mouseup", t.proxy(function(t) { return this.isDisabled ? !1 : void(this.isResizing() || t.stopPropagation()) }, this)), this.setDocumentSelectionChangeEvent(), this.setWindowMouseUpEvent(), this.setWindowKeyDownEvent(), this.setWindowKeyUpEvent(), this.setWindowOrientationChangeEvent(), this.setWindowHideEvent(), this.setWindowBlurEvent(), this.options.trackScroll && this.setWindowScrollEvent(), this.setWindowResize()
  }, e.prototype.setWindowResize = function() { this.$window.on("resize." + this._id, t.proxy(function() { this.hide(), this.closeImageMode(), this.imageMode = !1 }, this)) }, e.prototype.blur = function(e) { this.blurred || this.pasting || (this.selectionDisabled = !0, this.triggerEvent("blur", []), e && 0 === t("*:focus").length && this.clearSelection(), this.isLink || this.isImage || (this.selectionDisabled = !1), this.blurred = !0) }, e.prototype.setWindowBlurEvent = function() { this.$window.on("blur." + this._id, t.proxy(function(t, e) { this.blur(e) }, this)) }, e.prototype.setWindowHideEvent = function() { this.$window.on("hide." + this._id, t.proxy(function() { this.isResizing() ? this.$element.find(".f-img-handle").trigger("moveend") : this.hide(!1) }, this)) }, e.prototype.setWindowOrientationChangeEvent = function() { this.$window.on("orientationchange." + this._id, t.proxy(function() { setTimeout(t.proxy(function() { this.hide() }, this), 10) }, this)) }, e.prototype.setDocumentSelectionChangeEvent = function() { this.$document.on("selectionchange." + this._id, t.proxy(function(e) { return this.isDisabled ? !1 : void(this.isResizing() || this.isScrolling || (clearTimeout(this.selectionChangedTimeout), this.selectionChangedTimeout = setTimeout(t.proxy(function() { if (this.options.inlineMode && this.selectionInEditor() && this.link !== !0 && this.isTouch()) { var t = this.text(); "" !== t ? (this.iPod() ? this.options.alwaysVisible && this.hide() : this.show(null), e.stopPropagation()) : this.options.alwaysVisible ? this.show(null) : (this.hide(), this.closeImageMode(), this.imageMode = !1) } }, this), 75))) }, this)) }, e.prototype.setWindowMouseUpEvent = function() { this.$window.on(this.mouseup + "." + this._id, t.proxy(function() { return this.browser.webkit && !this.initMouseUp ? (this.initMouseUp = !0, !1) : (this.isResizing() || this.isScrolling || this.isDisabled || (this.$bttn_wrapper.find("button.fr-trigger").removeClass("active"), this.selectionInEditor() && "" !== this.text() && !this.isTouch() ? this.show(null) : this.$popup_editor.is(":visible") && (this.hide(), this.closeImageMode(), this.imageMode = !1), this.blur(!0)), void t("[data-down]").removeAttr("data-down")) }, this)) }, e.prototype.setWindowKeyDownEvent = function() { this.$window.on("keydown." + this._id, t.proxy(function(e) { var i = e.which; if (27 == i && (this.focus(), this.restoreSelection(), this.hide(), this.closeImageMode(), this.imageMode = !1), this.imageMode) { if (13 == i) return this.$element.find(".f-img-editor").parents(".f-img-wrap").before("<br/>"), this.sync(), this.$element.find(".f-img-editor img").click(), !1; if (46 == i || 8 == i) return e.stopPropagation(), e.preventDefault(), setTimeout(t.proxy(function() { this.removeImage(this.$element.find(".f-img-editor img")) }, this), 0), !1 } else if (this.selectionInEditor()) { if (this.isDisabled) return !0; var n = (e.ctrlKey || e.metaKey) && !e.altKey;!n && this.$popup_editor.is(":visible") && this.$bttn_wrapper.is(":visible") && this.options.inlineMode && (this.hide(), this.closeImageMode(), this.imageMode = !1) } }, this)) }, e.prototype.setWindowKeyUpEvent = function() { this.$window.on("keyup." + this._id, t.proxy(function() { return this.isDisabled ? !1 : void(this.selectionInEditor() && "" !== this.text() && !this.$popup_editor.is(":visible") && this.repositionEditor()) }, this)) }, e.prototype.setWindowScrollEvent = function() { t.merge(this.$window, t(this.options.scrollableContainer)).on("scroll." + this._id, t.proxy(function() { return this.isDisabled ? !1 : (clearTimeout(this.scrollTimer), this.isScrolling = !0, void(this.scrollTimer = setTimeout(t.proxy(function() { this.isScrolling = !1 }, this), 2500))) }, this)) }, e.prototype.setPlaceholder = function(e) { e && (this.options.placeholder = e), this.$textarea && this.$textarea.attr("placeholder", this.options.placeholder), this.$placeholder || (this.$placeholder = t('<span class="fr-placeholder" unselectable="on"></span>').bind("click", t.proxy(function() { this.focus() }, this)), this.$element.after(this.$placeholder)), this.$placeholder.text(this.options.placeholder) }, e.prototype.isEmpty = function() { var e = this.$element.text().replace(/(\r\n|\n|\r|\t|\u200B|\u0020)/gm, ""); return "" === e && 0 === this.$element.find("img, table, iframe, input, textarea, hr, li, object").length && 0 === this.$element.find(this.options.defaultTag + " > br, br").length && 0 === this.$element.find(t.map(this.valid_nodes, t.proxy(function(t) { return this.options.defaultTag == t ? null : t }, this)).join(", ")).length }, e.prototype.checkPlaceholder = function(i) {
    if (this.isDisabled && !i) return !1;
    if (this.pasting && !i) return !1;
    if (this.$element.find("td:empty, th:empty").append(t.Editable.INVISIBLE_SPACE), this.$element.find(this.valid_nodes.join(":empty, ") + ":empty").append(this.br), !this.isHTML)
      if (this.isEmpty() && !this.fakeEmpty()) {
        var n, s = this.selectionInEditor() || this.$element.is(":focus");
        this.options.paragraphy ? (n = t("<" + this.options.defaultTag + ">" + this.br + "</" + this.options.defaultTag + ">"), this.$element.html(n), s && this.setSelection(n.get(0)), this.$element.addClass("f-placeholder")) : (0 !== this.$element.find("br").length || this.browser.msie && e.getIEversion() <= 10 || (this.$element.append(this.br), s && this.browser.msie && this.focus()), this.$element.addClass("f-placeholder"))
      } else !this.$element.find(this.options.defaultTag + ", li, td, th").length && this.options.paragraphy ? (this.wrapText(!0), this.$element.find(this.options.defaultTag).length && "" === this.text() ? this.setSelection(this.$element.find(this.options.defaultTag)[0], this.$element.find(this.options.defaultTag).text().length, null, this.$element.find(this.options.defaultTag).text().length) : this.$element.removeClass("f-placeholder")) : this.fakeEmpty() === !1 && (!this.options.paragraphy || this.$element.find(this.valid_nodes.join(",")).length >= 1) ? this.$element.removeClass("f-placeholder") : !this.options.paragraphy && this.$element.find(this.valid_nodes.join(",")).length >= 1 ? this.$element.removeClass("f-placeholder") : this.$element.addClass("f-placeholder");
    return !0
  }, e.prototype.fakeEmpty = function(t) {
    void 0 === t && (t = this.$element);
    var e = !0;
    this.options.paragraphy && (e = 1 == t.find(this.options.defaultTag).length ? !0 : !1);
    var i = t.text().replace(/(\r\n|\n|\r|\t|\u200B)/gm, "");
    return "" === i && e && 1 == t.find("br, li").length && 0 === t.find("img, table, iframe, input, textarea, hr, li").length
  }, e.prototype.setPlaceholderEvents = function() { this.browser.msie && e.getIEversion() < 9 || (this.$element.on("focus click", t.proxy(function(t) { return this.isDisabled ? !1 : void("" !== this.$element.text() || this.pasting || (this.$element.data("focused") || "click" !== t.type ? "focus" == t.type && this.focus(!1) : this.$element.focus(), this.$element.data("focused", !0))) }, this)), this.$element.on("keyup keydown input focus placeholderCheck", t.proxy(function() { return this.checkPlaceholder() }, this)), this.$element.trigger("placeholderCheck")) }, e.prototype.setDimensions = function(t, e, i, n) { t && (this.options.height = t), e && (this.options.width = e), i && (this.options.minHeight = i), n && (this.options.maxHeight = n), "auto" != this.options.height && (this.$wrapper.css("height", this.options.height), this.$element.css("minHeight", this.options.height - parseInt(this.$element.css("padding-top"), 10) - parseInt(this.$element.css("padding-bottom"), 10))), "auto" != this.options.minHeight && (this.$wrapper.css("minHeight", this.options.minHeight), this.$element.css("minHeight", this.options.minHeight)), "auto" != this.options.maxHeight && this.$wrapper.css("maxHeight", this.options.maxHeight), "auto" != this.options.width && this.$box.css("width", this.options.width) }, e.prototype.setDirection = function(t) { t && (this.options.direction = t), "ltr" != this.options.direction && "rtl" != this.options.direction && (this.options.direction = "ltr"), "rtl" == this.options.direction ? (this.$element.removeAttr("dir"), this.$box.addClass("f-rtl"), this.$element.addClass("f-rtl"), this.$editor.addClass("f-rtl"), this.$popup_editor.addClass("f-rtl"), this.$image_modal && this.$image_modal.addClass("f-rtl")) : (this.$element.attr("dir", "auto"), this.$box.removeClass("f-rtl"), this.$element.removeClass("f-rtl"), this.$editor.removeClass("f-rtl"), this.$popup_editor.removeClass("f-rtl"), this.$image_modal && this.$image_modal.removeClass("f-rtl")) }, e.prototype.setZIndex = function(t) { t && (this.options.zIndex = t), this.$editor.css("z-index", this.options.zIndex), this.$popup_editor.css("z-index", this.options.zIndex + 1), this.$overlay && this.$overlay.css("z-index", this.options.zIndex + 1002), this.$image_modal && this.$image_modal.css("z-index", this.options.zIndex + 1003) }, e.prototype.setTheme = function(t) { t && (this.options.theme = t), null != this.options.theme && (this.$editor.addClass(this.options.theme + "-theme"), this.$popup_editor.addClass(this.options.theme + "-theme"), this.$box && this.$box.addClass(this.options.theme + "-theme"), this.$image_modal && this.$image_modal.addClass(this.options.theme + "-theme")) }, e.prototype.setSpellcheck = function(t) { void 0 !== t && (this.options.spellcheck = t), this.$element.attr("spellcheck", this.options.spellcheck) }, e.prototype.customizeText = function(e) {
    if (e) {
      var i = this.$editor.find("[title]").add(this.$popup_editor.find("[title]"));
      this.$image_modal && (i = i.add(this.$image_modal.find("[title]"))), i.each(t.proxy(function(i, n) { for (var s in e) t(n).attr("title").toLowerCase() == s.toLowerCase() && t(n).attr("title", e[s]) }, this)), i = this.$editor.find('[data-text="true"]').add(this.$popup_editor.find('[data-text="true"]')), this.$image_modal && (i = i.add(this.$image_modal.find('[data-text="true"]'))), i.each(t.proxy(function(i, n) { for (var s in e) t(n).text().toLowerCase() == s.toLowerCase() && t(n).text(e[s]) }, this))
    }
  }, e.prototype.setLanguage = function(e) { void 0 !== e && (this.options.language = e), t.Editable.LANGS[this.options.language] && (this.customizeText(t.Editable.LANGS[this.options.language].translation), t.Editable.LANGS[this.options.language].direction && t.Editable.LANGS[this.options.language].direction != t.Editable.DEFAULTS.direction && this.setDirection(t.Editable.LANGS[this.options.language].direction), t.Editable.LANGS[this.options.language].translation[this.options.placeholder] && this.setPlaceholder(t.Editable.LANGS[this.options.language].translation[this.options.placeholder])) }, e.prototype.setCustomText = function(t) { t && (this.options.customText = t), this.options.customText && this.customizeText(this.options.customText) }, e.prototype.execHTML = function() { this.html() }, e.prototype.initHTMLArea = function() {
    this.$html_area = t('<textarea wrap="hard">').keydown(function(e) {
      var i = e.keyCode || e.which;
      if (9 == i) {
        e.preventDefault();
        var n = t(this).get(0).selectionStart,
          s = t(this).get(0).selectionEnd;
        t(this).val(t(this).val().substring(0, n) + " " + t(this).val().substring(s)), t(this).get(0).selectionStart = t(this).get(0).selectionEnd = n + 1
      }
    }).focus(t.proxy(function() { this.blurred && (this.blurred = !1, this.triggerEvent("focus", [], !1)) }, this)).mouseup(t.proxy(function() { this.blurred && (this.blurred = !1, this.triggerEvent("focus", [], !1)) }, this))
  }, e.prototype.command_dispatcher = {
    align: function(t) {
      var e = this.buildDropdownAlign(t),
        i = this.buildDropdownButton(t, e);
      return i
    },
    formatBlock: function(t) {
      var e = this.buildDropdownFormatBlock(t),
        i = this.buildDropdownButton(t, e);
      return i
    },
    html: function(e) { var i = this.buildDefaultButton(e); return this.options.inlineMode && this.$box.append(t(i).clone(!0).addClass("html-switch").attr("title", "Hide HTML").click(t.proxy(this.execHTML, this))), this.initHTMLArea(), i }
  }, e.prototype.setButtons = function(t) {
    t && (this.options.buttons = t), this.$editor.append('<div class="bttn-wrapper" id="bttn-wrapper-' + this._id + '">'), this.$bttn_wrapper = this.$editor.find("#bttn-wrapper-" + this._id), this.mobile() && this.$bttn_wrapper.addClass("touch");
    for (var i, n, s = "", o = 0; o < this.options.buttons.length; o++) {
      var r = this.options.buttons[o];
      if ("sep" != r) {
        var a = e.commands[r];
        if (void 0 !== a) {
          a.cmd = r;
          var l = this.command_dispatcher[a.cmd];
          l ? s += l.apply(this, [a]) : a.seed ? (i = this.buildDefaultDropdown(a), n = this.buildDropdownButton(a, i), s += n) : (n = this.buildDefaultButton(a), s += n, this.bindRefreshListener(a))
        } else {
          if (a = this.options.customButtons[r], void 0 === a) {
            if (a = this.options.customDropdowns[r], void 0 === a) continue;
            n = this.buildCustomDropdown(a, r), s += n, this.bindRefreshListener(a);
            continue
          }
          n = this.buildCustomButton(a, r), s += n, this.bindRefreshListener(a)
        }
      } else s += this.options.inlineMode ? '<div class="f-clear"></div><hr/>' : '<span class="f-sep"></span>'
    }
    this.$bttn_wrapper.html(s), this.$bttn_wrapper.find('button[data-cmd="undo"], button[data-cmd="redo"]').prop("disabled", !0), this.bindButtonEvents()
  }, e.prototype.bindRefreshListener = function(e) { e.refresh && this.addListener("refresh", t.proxy(function() { e.refresh.apply(this, [e.cmd]) }, this)) }, e.prototype.buildDefaultButton = function(t) { var e = '<button tabIndex="-1" type="button" class="fr-bttn" title="' + t.title + '" data-cmd="' + t.cmd + '">'; return e += void 0 === this.options.icons[t.cmd] ? this.addButtonIcon(t) : this.prepareIcon(this.options.icons[t.cmd], t.title), e += "</button>" }, e.prototype.prepareIcon = function(t, e) {
    switch (t.type) {
      case "font":
        return this.addButtonIcon({ icon: t.value });
      case "img":
        return this.addButtonIcon({ icon_img: t.value, title: e });
      case "txt":
        return this.addButtonIcon({ icon_txt: t.value })
    }
  }, e.prototype.addButtonIcon = function(t) { return t.icon ? '<i class="' + t.icon + '"></i>' : t.icon_alt ? '<i class="for-text">' + t.icon_alt + "</i>" : t.icon_img ? '<img src="' + t.icon_img + '" alt="' + t.title + '"/>' : t.icon_txt ? "<i>" + t.icon_txt + "</i>" : t.title }, e.prototype.buildCustomButton = function(t, e) { this["call_" + e] = t.callback; var i = '<button tabIndex="-1" type="button" class="fr-bttn" data-callback="call_' + e + '" data-cmd="button_name" data-name="' + e + '" title="' + t.title + '">' + this.prepareIcon(t.icon, t.title) + "</button>"; return i }, e.prototype.callDropdown = function(e, i) { this.$bttn_wrapper.on("click touch", '[data-name="' + e + '"]', t.proxy(function(t) { t.preventDefault(), t.stopPropagation(), i.apply(this) }, this)) }, e.prototype.buildCustomDropdown = function(t, e) {
    var i = '<div class="fr-bttn fr-dropdown">';
    i += '<button tabIndex="-1" type="button" class="fr-trigger" title="' + t.title + '" data-name="' + e + '">' + this.prepareIcon(t.icon, t.title) + "</button>", i += '<ul class="fr-dropdown-menu">';
    var n = 0;
    for (var s in t.options) {
      this["call_" + e + n] = t.options[s];
      var o = '<li data-callback="call_' + e + n + '" data-cmd="' + e + n + '" data-name="' + e + n + '"><a href="#">' + s + "</a></li>";
      i += o, n++
    }
    return i += "</ul></div>"
  }, e.prototype.buildDropdownButton = function(t, e, i) {
    i = i || "";
    var n = '<div class="fr-bttn fr-dropdown ' + i + '">',
      s = "";
    s += void 0 === this.options.icons[t.cmd] ? this.addButtonIcon(t) : this.prepareIcon(this.options.icons[t.cmd], t.title);
    var o = '<button tabIndex="-1" type="button" data-name="' + t.cmd + '" class="fr-trigger" title="' + t.title + '">' + s + "</button>";
    return n += o, n += e, n += "</div>"
  }, e.prototype.buildDropdownAlign = function(t) {
    this.bindRefreshListener(t);
    for (var e = '<ul class="fr-dropdown-menu f-align">', i = 0; i < t.seed.length; i++) {
      var n = t.seed[i];
      e += '<li data-cmd="align" data-val="' + n.cmd + '" title="' + n.title + '"><a href="#"><i class="' + n.icon + '"></i></a></li>'
    }
    return e += "</ul>"
  }, e.prototype.buildDropdownFormatBlock = function(t) {
    var e = '<ul class="fr-dropdown-menu">';
    for (var i in this.options.blockTags) {
      var n = '<li data-cmd="' + t.cmd + '" data-val="' + i + '">';
      n += '<a href="#" data-text="true" class="format-' + i + '" title="' + this.options.blockTags[i] + '">' + this.options.blockTags[i] + "</a></li>", e += n
    }
    return e += "</ul>"
  }, e.prototype.buildDefaultDropdown = function(t) {
    for (var e = '<ul class="fr-dropdown-menu">', i = 0; i < t.seed.length; i++) {
      var n = t.seed[i],
        s = '<li data-namespace="' + t.namespace + '" data-cmd="' + (n.cmd || t.cmd) + '" data-val="' + n.value + '" data-param="' + (n.param || t.param) + '">';
      s += '<a href="#" data-text="true" class="' + n.value + '" title="' + n.title + '">' + n.title + "</a></li>", e += s
    }
    return e += "</ul>"
  }, e.prototype.createEditPopupHTML = function() { var t = '<div class="froala-popup froala-text-popup" style="display:none;">'; return t += '<h4><span data-text="true">Edit text</span><i title="Cancel" class="fa fa-times" id="f-text-close-' + this._id + '"></i></h4></h4>', t += '<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu" id="f-ti-' + this._id + '">', t += '<button data-text="true" type="button" class="f-ok" id="f-edit-popup-ok-' + this._id + '">OK</button>', t += "</div>", t += "</div>" }, e.prototype.buildEditPopup = function() { this.$edit_popup_wrapper = t(this.createEditPopupHTML()), this.$popup_editor.append(this.$edit_popup_wrapper), this.$edit_popup_wrapper.find("#f-ti-" + this._id).on("mouseup keydown", function(t) { t.stopPropagation() }), this.addListener("hidePopups", t.proxy(function() { this.$edit_popup_wrapper.hide() }, this)), this.$edit_popup_wrapper.on("click", "#f-edit-popup-ok-" + this._id, t.proxy(function() { this.$element.text(this.$edit_popup_wrapper.find("#f-ti-" + this._id).val()), this.sync(), this.hide() }, this)), this.$edit_popup_wrapper.on("click", "i#f-text-close-" + this._id, t.proxy(function() { this.hide() }, this)) }, e.prototype.createCORSRequest = function(t, e) { var i = new XMLHttpRequest; if ("withCredentials" in i) { i.open(t, e, !0), this.options.withCredentials && (i.withCredentials = !0); for (var n in this.options.headers) i.setRequestHeader(n, this.options.headers[n]) } else "undefined" != typeof XDomainRequest ? (i = new XDomainRequest, i.open(t, e)) : i = null; return i }, e.prototype.isEnabled = function(e) { return t.inArray(e, this.options.buttons) >= 0 }, e.prototype.bindButtonEvents = function() { this.bindDropdownEvents(this.$bttn_wrapper), this.bindCommandEvents(this.$bttn_wrapper) }, e.prototype.bindDropdownEvents = function(i) {
    var n = this;
    i.on(this.mousedown, ".fr-dropdown .fr-trigger:not([disabled])", function(e) { return "mousedown" === e.type && 1 !== e.which ? !0 : ("LI" === this.tagName && "touchstart" === e.type && n.android() || n.iOS() || e.preventDefault(), void t(this).attr("data-down", !0)) }), i.on(this.mouseup, ".fr-dropdown .fr-trigger:not([disabled])", function(s) {
      if (n.isDisabled) return !1;
      if (s.stopPropagation(), s.preventDefault(), !t(this).attr("data-down")) return t("[data-down]").removeAttr("data-down"), !1;
      t("[data-down]").removeAttr("data-down"), n.options.inlineMode === !1 && 0 === t(this).parents(".froala-popup").length && (n.hide(), n.closeImageMode(), n.imageMode = !1), t(this).toggleClass("active").trigger("blur");
      var o, r = t(this).attr("data-name");
      return e.commands[r] ? o = e.commands[r].refreshOnShow : n.options.customDropdowns[r] ? o = n.options.customDropdowns[r].refreshOnShow : e.image_commands[r] && (o = e.image_commands[r].refreshOnShow), o && o.call(n), i.find("button.fr-trigger").not(this).removeClass("active"), !1
    }), i.on(this.mouseup, ".fr-dropdown", function(t) { t.stopPropagation(), t.preventDefault() }), this.$element.on("mouseup", "img, a", t.proxy(function() { return this.isDisabled ? !1 : void i.find(".fr-dropdown .fr-trigger").removeClass("active") }, this)), i.on("click", "li[data-cmd] > a", function(t) { t.preventDefault() })
  }, e.prototype.bindCommandEvents = function(e) {
    var i = this;
    e.on(this.mousedown, "button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]", function(e) { return "mousedown" === e.type && 1 !== e.which ? !0 : ("LI" === this.tagName && "touchstart" === e.type && i.android() || i.iOS() || e.preventDefault(), void t(this).attr("data-down", !0)) }), e.on(this.mouseup + " " + this.move, "button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]", t.proxy(function(e) {
      if (i.isDisabled) return !1;
      if ("mouseup" === e.type && 1 !== e.which) return !0;
      var n = e.currentTarget;
      if ("touchmove" != e.type) {
        if (e.stopPropagation(), e.preventDefault(), !t(n).attr("data-down")) return t("[data-down]").removeAttr("data-down"), !1;
        if (t("[data-down]").removeAttr("data-down"), t(n).data("dragging") || t(n).attr("disabled")) return t(n).removeData("dragging"), !1;
        var s = t(n).data("timeout");
        s && (clearTimeout(s), t(n).removeData("timeout"));
        var o = t(n).attr("data-callback");
        if (i.options.inlineMode === !1 && 0 === t(n).parents(".froala-popup").length && (i.hide(), i.closeImageMode(), i.imageMode = !1), o) t(n).parents(".fr-dropdown").find(".fr-trigger.active").removeClass("active"), i[o]();
        else {
          var r = t(n).attr("data-namespace"),
            a = t(n).attr("data-cmd"),
            l = t(n).attr("data-val"),
            h = t(n).attr("data-param");
          r ? i["exec" + r](a, l, h) : (i.exec(a, l, h), i.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"))
        }
        return !1
      }
      t(n).data("timeout") || t(n).data("timeout", setTimeout(function() { t(n).data("dragging", !0) }, 200))
    }, this))
  }, e.prototype.save = function() {
    if (!this.triggerEvent("beforeSave", [], !1)) return !1;
    if (this.options.saveURL) {
      var e = {};
      for (var i in this.options.saveParams) {
        var n = this.options.saveParams[i];
        e[i] = "function" == typeof n ? n.call(this) : n
      }
      var s = {};
      s[this.options.saveParam] = this.getHTML(), t.ajax({ type: this.options.saveRequestType, url: this.options.saveURL, data: t.extend(s, e), crossDomain: this.options.crossDomain, xhrFields: { withCredentials: this.options.withCredentials }, headers: this.options.headers }).done(t.proxy(function(t) { this.triggerEvent("afterSave", [t]) }, this)).fail(t.proxy(function() { this.triggerEvent("saveError", ["Save request failed on the server."]) }, this))
    } else this.triggerEvent("saveError", ["Missing save URL."])
  }, e.prototype.isURL = function(t) {
    if (!/^(https?:|ftps?:|)\/\//.test(t)) return !1;
    t = String(t).replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22").replace(/ /g, "%20");
    var e = /\(?(?:(https?:|ftps?:|)\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|(?:www.)?(?:[^\W\s]|\.|-)|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/gi;
    return e.test(t)
  }, e.prototype.sanitizeURL = function(t) { if (/^(https?:|ftps?:|)\/\//.test(t)) { if (!this.isURL(t)) return "" } else t = encodeURIComponent(t).replace(/%23/g, "#").replace(/%2F/g, "/").replace(/%25/g, "%").replace(/mailto%3A/g, "mailto:").replace(/tel%3A/g, "tel:").replace(/data%3Aimage/g, "data:image").replace(/webkit-fake-url%3A/g, "webkit-fake-url:").replace(/%3F/g, "?").replace(/%3D/g, "=").replace(/%26/g, "&").replace(/&amp;/g, "&").replace(/%2C/g, ",").replace(/%3B/g, ";").replace(/%2B/g, "+").replace(/%40/g, "@"); return t }, e.prototype.parents = function(t, e) { return t.get(0) != this.$element.get(0) ? t.parentsUntil(this.$element, e) : [] }, e.prototype.option = function(e, i) {
    if (void 0 === e) return this.options;
    if (e instanceof Object) this.options = t.extend({}, this.options, e), this.initOptions(), this.setCustomText(), this.setLanguage(), this.setAllowScript(), this.setAllowStyle();
    else {
      if (void 0 === i) return this.options[e];
      switch (this.options[e] = i, e) {
        case "direction":
          this.setDirection();
          break;
        case "height":
        case "width":
        case "minHeight":
        case "maxHeight":
          this.setDimensions();
          break;
        case "spellcheck":
          this.setSpellcheck();
          break;
        case "placeholder":
          this.setPlaceholder();
          break;
        case "customText":
          this.setCustomText();
          break;
        case "language":
          this.setLanguage();
          break;
        case "textNearImage":
          this.setTextNearImage();
          break;
        case "zIndex":
          this.setZIndex();
          break;
        case "theme":
          this.setTheme();
          break;
        case "allowScript":
          this.setAllowScript();
          break;
        case "allowStyle":
          this.setAllowStyle()
      }
    }
  };
  var i = t.fn.editable;
  t.fn.editable = function(i) {
    for (var n = [], s = 0; s < arguments.length; s++) n.push(arguments[s]);
    if ("string" == typeof i) {
      var o = [];
      return this.each(function() {
        var e = t(this),
          s = e.data("fa.editable");
        if (!s[i]) return t.error("Method " + i + " does not exist in Froala Editor.");
        var r = s[i].apply(s, n.slice(1));
        void 0 === r ? o.push(this) : 0 === o.length && o.push(r)
      }), 1 == o.length ? o[0] : o
    }
    return "object" != typeof i && i ? void 0 : this.each(function() {
      var n = this,
        s = t(n),
        o = s.data("fa.editable");
      o || s.data("fa.editable", o = new e(n, i))
    })
  }, t.fn.editable.Constructor = e, t.Editable = e, t.fn.editable.noConflict = function() { return t.fn.editable = i, this }
}(window.jQuery),
function(t) {
  t.Editable.prototype.initUndoRedo = function() { this.undoStack = [], this.undoIndex = 0, this.saveUndoStep(), this.disableBrowserUndo() }, t.Editable.prototype.undo = function() {
    if (this.no_verify = !0, this.undoIndex > 1) {
      clearTimeout(this.typingTimer), this.triggerEvent("beforeUndo", [], !1);
      var t = this.undoStack[--this.undoIndex - 1];
      this.restoreSnapshot(t), this.doingRedo = !0, this.triggerEvent("afterUndo", []), this.doingRedo = !1, "" !== this.text() ? this.repositionEditor() : this.hide(), this.$element.trigger("placeholderCheck"), this.focus(), this.refreshButtons()
    }
    this.no_verify = !1
  }, t.Editable.prototype.redo = function() {
    if (this.no_verify = !0, this.undoIndex < this.undoStack.length) {
      clearTimeout(this.typingTimer), this.triggerEvent("beforeRedo", [], !1);
      var t = this.undoStack[this.undoIndex++];
      this.restoreSnapshot(t), this.doingRedo = !0, this.triggerEvent("afterRedo", []), this.doingRedo = !1, "" !== this.text() ? this.repositionEditor() : this.hide(), this.$element.trigger("placeholderCheck"), this.focus(), this.refreshButtons()
    }
    this.no_verify = !1
  }, t.Editable.prototype.saveUndoStep = function() {
    if (!this.undoStack) return !1;
    for (; this.undoStack.length > this.undoIndex;) this.undoStack.pop();
    var t = this.getSnapshot();
    this.undoStack[this.undoIndex - 1] && this.identicSnapshots(this.undoStack[this.undoIndex - 1], t) || (this.undoStack.push(t), this.undoIndex++), this.refreshUndo(), this.refreshRedo()
  }, t.Editable.prototype.refreshUndo = function() {
    if (this.isEnabled("undo")) {
      if (void 0 === this.$editor) return;
      this.$bttn_wrapper.find('[data-cmd="undo"]').removeAttr("disabled"), (0 === this.undoStack.length || this.undoIndex <= 1 || this.isHTML) && this.$bttn_wrapper.find('[data-cmd="undo"]').attr("disabled", !0)
    }
  }, t.Editable.prototype.refreshRedo = function() {
    if (this.isEnabled("redo")) {
      if (void 0 === this.$editor) return;
      this.$bttn_wrapper.find('[data-cmd="redo"]').removeAttr("disabled"), (this.undoIndex == this.undoStack.length || this.isHTML) && this.$bttn_wrapper.find('[data-cmd="redo"]').prop("disabled", !0)
    }
  }, t.Editable.prototype.getNodeIndex = function(t) {
    for (var e = t.parentNode.childNodes, i = 0, n = null, s = 0; s < e.length; s++) {
      if (n) {
        var o = 3 === e[s].nodeType && "" === e[s].textContent,
          r = 3 === n.nodeType && 3 === e[s].nodeType;
        o || r || i++
      }
      if (e[s] == t) return i;
      n = e[s]
    }
  }, t.Editable.prototype.getNodeLocation = function(t) { var e = []; if (!t.parentNode) return []; for (; t != this.$element.get(0);) e.push(this.getNodeIndex(t)), t = t.parentNode; return e.reverse() }, t.Editable.prototype.getNodeByLocation = function(t) { for (var e = this.$element.get(0), i = 0; i < t.length; i++) e = e.childNodes[t[i]]; return e }, t.Editable.prototype.getRealNodeOffset = function(t, e) {
    for (; t && 3 === t.nodeType;) {
      var i = t.previousSibling;
      i && 3 == i.nodeType && (e += i.textContent.length), t = i
    }
    return e
  }, t.Editable.prototype.getRangeSnapshot = function(t) { return { scLoc: this.getNodeLocation(t.startContainer), scOffset: this.getRealNodeOffset(t.startContainer, t.startOffset), ecLoc: this.getNodeLocation(t.endContainer), ecOffset: this.getRealNodeOffset(t.endContainer, t.endOffset) } }, t.Editable.prototype.getSnapshot = function() {
    var t = {};
    if (t.html = this.$element.html(), t.ranges = [], this.selectionInEditor() && this.$element.is(":focus"))
      for (var e = this.getRanges(), i = 0; i < e.length; i++) t.ranges.push(this.getRangeSnapshot(e[i]));
    return t
  }, t.Editable.prototype.identicSnapshots = function(t, e) { return t.html != e.html ? !1 : JSON.stringify(t.ranges) != JSON.stringify(e.ranges) ? !1 : !0 }, t.Editable.prototype.restoreRangeSnapshot = function(t, e) {
    try {
      var i = this.getNodeByLocation(t.scLoc),
        n = t.scOffset,
        s = this.getNodeByLocation(t.ecLoc),
        o = t.ecOffset,
        r = this.document.createRange();
      r.setStart(i, n), r.setEnd(s, o), e.addRange(r)
    } catch (a) {}
  }, t.Editable.prototype.restoreSnapshot = function(e) {
    this.$element.html() != e.html && this.$element.html(e.html);
    var i = this.getSelection();
    this.clearSelection(), this.$element.focus();
    for (var n = 0; n < e.ranges.length; n++) this.restoreRangeSnapshot(e.ranges[n], i);
    setTimeout(t.proxy(function() { this.$element.find(".f-img-wrap img").click() }, this), 0)
  }
}(jQuery),
function(t) {
  t.Editable.prototype.refreshButtons = function(e) { return this.initialized && (this.selectionInEditor() && !this.isHTML || this.browser.msie && t.Editable.getIEversion() < 9 || e) ? (this.$editor.find("button[data-cmd]").removeClass("active"), this.refreshDisabledState(), void this.raiseEvent("refresh")) : !1 }, t.Editable.prototype.refreshDisabledState = function() {
    if (this.isHTML) return !1;
    if (this.$editor) {
      for (var e = 0; e < this.options.buttons.length; e++) {
        var i = this.options.buttons[e];
        if (void 0 !== t.Editable.commands[i]) {
          var n = !1;
          t.isFunction(t.Editable.commands[i].disabled) ? n = t.Editable.commands[i].disabled.apply(this) : void 0 !== t.Editable.commands[i].disabled && (n = !0), n ? (this.$editor.find('button[data-cmd="' + i + '"]').prop("disabled", !0), this.$editor.find('button[data-name="' + i + '"]').prop("disabled", !0)) : (this.$editor.find('button[data-cmd="' + i + '"]').removeAttr("disabled"), this.$editor.find('button[data-name="' + i + '"]').removeAttr("disabled"))
        }
      }
      this.refreshUndo(), this.refreshRedo()
    }
  }, t.Editable.prototype.refreshFormatBlocks = function() {
    var t = this.getSelectionElements()[0],
      e = t.tagName.toLowerCase();
    this.options.paragraphy && e === this.options.defaultTag.toLowerCase() && (e = "n"), this.$editor.find('.fr-bttn > button[data-name="formatBlock"] + ul li').removeClass("active"), this.$bttn_wrapper.find('.fr-bttn > button[data-name="formatBlock"] + ul li[data-val="' + e + '"]').addClass("active")
  }, t.Editable.prototype.refreshDefault = function(t) { try { this.document.queryCommandState(t) === !0 && this.$editor.find('[data-cmd="' + t + '"]').addClass("active") } catch (e) {} }, t.Editable.prototype.refreshAlign = function() {
    var e = t(this.getSelectionElements()[0]);
    this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");
    var i, n = e.css("text-align");
    ["left", "right", "justify", "center"].indexOf(n) < 0 && (n = "left"), "left" == n ? i = "justifyLeft" : "right" == n ? i = "justifyRight" : "justify" == n ? i = "justifyFull" : "center" == n && (i = "justifyCenter"), this.$editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class", "fa fa-align-" + n), this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="' + i + '"]').addClass("active")
  }, t.Editable.prototype.refreshHTML = function() { this.isActive("html") ? this.$editor.find('[data-cmd="html"]').addClass("active") : this.$editor.find('[data-cmd="html"]').removeClass("active") }
}(jQuery),
function(t) {
  t.Editable.commands = { bold: { title: "Bold", icon: "fa fa-bold", shortcut: "(Ctrl + B)", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, italic: { title: "Italic", icon: "fa fa-italic", shortcut: "(Ctrl + I)", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, underline: { cmd: "underline", title: "Underline", icon: "fa fa-underline", shortcut: "(Ctrl + U)", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, strikeThrough: { title: "Strikethrough", icon: "fa fa-strikethrough", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, subscript: { title: "Subscript", icon: "fa fa-subscript", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, superscript: { title: "Superscript", icon: "fa fa-superscript", refresh: t.Editable.prototype.refreshDefault, undo: !0, callbackWithoutSelection: function(t) { this._startInDefault(t) } }, formatBlock: { title: "Format Block", icon: "fa fa-paragraph", refreshOnShow: t.Editable.prototype.refreshFormatBlocks, callback: function(t, e) { this.formatBlock(e) }, undo: !0 }, align: { title: "Alignment", icon: "fa fa-align-left", refresh: t.Editable.prototype.refreshAlign, refreshOnShow: t.Editable.prototype.refreshAlign, seed: [{ cmd: "justifyLeft", title: "Align Left", icon: "fa fa-align-left" }, { cmd: "justifyCenter", title: "Align Center", icon: "fa fa-align-center" }, { cmd: "justifyRight", title: "Align Right", icon: "fa fa-align-right" }, { cmd: "justifyFull", title: "Justify", icon: "fa fa-align-justify" }], callback: function(t, e) { this.align(e) }, undo: !0 }, outdent: { title: "Indent Less", icon: "fa fa-dedent", activeless: !0, shortcut: "(Ctrl + <)", callback: function() { this.outdent(!0) }, undo: !0 }, indent: { title: "Indent More", icon: "fa fa-indent", activeless: !0, shortcut: "(Ctrl + >)", callback: function() { this.indent() }, undo: !0 }, selectAll: { title: "Select All", icon: "fa fa-file-text", shortcut: "(Ctrl + A)", callback: function(t, e) { this.$element.focus(), this.execDefault(t, e) }, undo: !1 }, createLink: { title: "Insert Link", icon: "fa fa-link", shortcut: "(Ctrl + K)", callback: function() { this.insertLink() }, undo: !1 }, insertImage: { title: "Insert Image", icon: "fa fa-picture-o", activeless: !0, shortcut: "(Ctrl + P)", callback: function() { this.insertImage() }, undo: !1 }, undo: { title: "Undo", icon: "fa fa-undo", activeless: !0, shortcut: "(Ctrl+Z)", refresh: t.Editable.prototype.refreshUndo, callback: function() { this.undo() }, undo: !1 }, redo: { title: "Redo", icon: "fa fa-repeat", activeless: !0, shortcut: "(Shift+Ctrl+Z)", refresh: t.Editable.prototype.refreshRedo, callback: function() { this.redo() }, undo: !1 }, html: { title: "Show HTML", icon: "fa fa-code", refresh: t.Editable.prototype.refreshHTML, callback: function() { this.html() }, undo: !1 }, save: { title: "Save", icon: "fa fa-floppy-o", callback: function() { this.save() }, undo: !1 }, insertHorizontalRule: { title: "Insert Horizontal Line", icon: "fa fa-minus", callback: function(t) { this.insertHR(t) }, undo: !0 }, removeFormat: { title: "Clear formatting", icon: "fa fa-eraser", activeless: !0, callback: function() { this.removeFormat() }, undo: !0 } }, t.Editable.prototype.exec = function(e, i, n) { return !this.selectionInEditor() && t.Editable.commands[e].undo && this.focus(), this.selectionInEditor() && "" === this.text() && t.Editable.commands[e].callbackWithoutSelection ? (t.Editable.commands[e].callbackWithoutSelection.apply(this, [e, i, n]), !1) : void(t.Editable.commands[e].callback ? t.Editable.commands[e].callback.apply(this, [e, i, n]) : this.execDefault(e, i)) }, t.Editable.prototype.html = function() {
    var t;
    this.isHTML ? (this.isHTML = !1, t = this.$html_area.val(), this.$box.removeClass("f-html"), this.$element.attr("contenteditable", !0), this.setHTML(t, !1), this.$editor.find('.fr-bttn:not([data-cmd="html"]), .fr-trigger').removeAttr("disabled"), this.$editor.find('.fr-bttn[data-cmd="html"]').removeClass("active"), this.$element.blur(), this.focus(), this.refreshButtons(), this.triggerEvent("htmlHide", [t], !0, !1)) : (this.$box.removeClass("f-placeholder"), this.clearSelection(), this.cleanify(!1, !0, !1), t = this.cleanTags(this.getHTML(!1, !1)), this.$html_area.val(t).trigger("resize"), this.$html_area.css("height", this.$element.height() - 1), this.$element.html("").append(this.$html_area).removeAttr("contenteditable"), this.$box.addClass("f-html"), this.$editor.find('button.fr-bttn:not([data-cmd="html"]), button.fr-trigger').attr("disabled", !0), this.$editor.find('.fr-bttn[data-cmd="html"]').addClass("active"), this.isHTML = !0, this.hide(), this.imageMode = !1, this.$element.blur(), this.$element.removeAttr("contenteditable"), this.triggerEvent("htmlShow", [t], !0, !1))
  }, t.Editable.prototype.insertHR = function(e) {
    this.$element.find("hr").addClass("fr-tag"), this.$element.hasClass("f-placeholder") ? t(this.$element.find("> " + this.valid_nodes.join(", >"))[0]).before("<hr/>") : this.document.execCommand(e), this.hide();
    var i = this.$element.find("hr:not(.fr-tag)").next(this.valid_nodes.join(","));
    i.length > 0 ? t(i[0]).prepend(this.markers_html) : this.$element.find("hr:not(.fr-tag)").after(this.options.paragraphy ? "<p>" + this.markers_html + "<br/></p>" : this.markers_html), this.restoreSelectionByMarkers(), this.triggerEvent(e, [], !0, !1)
  }, t.Editable.prototype.formatBlock = function(e) {
    if (this.disabledList.indexOf("formatBlock") >= 0) return !1;
    if (this.browser.msie && t.Editable.getIEversion() < 9) return "n" == e && (e = this.options.defaultTag), this.document.execCommand("formatBlock", !1, "<" + e + ">"), this.triggerEvent("formatBlock"), !1;
    if (this.$element.hasClass("f-placeholder")) {
      if (this.options.paragraphy || "n" != e) {
        "n" == e && (e = this.options.defaultTag);
        var i = t("<" + e + "><br/></" + e + ">");
        this.$element.html(i), this.setSelection(i.get(0), 0), this.$element.removeClass("f-placeholder")
      }
    } else {
      this.saveSelectionByMarkers(), this.wrapText(), this.restoreSelectionByMarkers();
      var n = this.getSelectionElements();
      n[0] == this.$element.get(0) && (n = this.$element.find("> " + this.valid_nodes.join(", >"))), this.saveSelectionByMarkers();
      for (var s, o = function(e) {
          if ("PRE" == e.get(0).tagName)
            for (; e.find("br + br").length > 0;) {
              var i = t(e.find("br + br")[0]);
              i.prev().remove(), i.replaceWith("\n\n")
            }
        }, r = 0; r < n.length; r++) {
        var a = t(n[r]);
        if (!this.fakeEmpty(a)) {
          if (o(a), !this.options.paragraphy && this.emptyElement(a.get(0)) && a.append("<br/>"), "n" == e)
            if (this.options.paragraphy) {
              var l = "<" + this.options.defaultTag + this.attrs(a.get(0)) + ">" + a.html() + "</" + this.options.defaultTag + ">";
              s = t(l)
            } else s = a.html() + "<br/>";
          else s = t("<" + e + this.attrs(a.get(0)) + ">").html(a.html());
          a.get(0) != this.$element.get(0) ? a.replaceWith(s) : a.html(s)
        }
      }
      this.unwrapText(), this.$element.find("pre + pre").each(function() { t(this).prepend(t(this).prev().html() + "<br/><br/>"), t(this).prev().remove() });
      var h = this;
      this.$element.find(this.valid_nodes.join(",")).each(function() { "PRE" != this.tagName && t(this).replaceWith("<" + this.tagName + h.attrs(this) + ">" + t(this).html().replace(/\n\n/gi, "</" + this.tagName + "><" + this.tagName + ">") + "</" + this.tagName + ">") }), this.$element.find(this.valid_nodes.join(":empty ,") + ":empty").append("<br/>"), this.cleanupLists(), this.restoreSelectionByMarkers()
    }
    this.triggerEvent("formatBlock"), this.repositionEditor()
  }, t.Editable.prototype.align = function(e) {
    if (this.browser.msie && t.Editable.getIEversion() < 9) return this.document.execCommand(e, !1, !1), this.triggerEvent("align", [e]), !1;
    this.saveSelectionByMarkers(), this.wrapText(), this.restoreSelectionByMarkers(), this.saveSelectionByMarkers();
    var i = this.getSelectionElements();
    "justifyLeft" == e ? e = "left" : "justifyRight" == e ? e = "right" : "justifyCenter" == e ? e = "center" : "justifyFull" == e && (e = "justify");
    for (var n = 0; n < i.length; n++) this.parents(t(i[n]), "LI").length > 0 && (i[n] = t(i[n]).parents("LI").get(0)), t(i[n]).css("text-align", e);
    this.cleanupLists(), this.unwrapText(), this.restoreSelectionByMarkers(), this.repositionEditor(), this.triggerEvent("align", [e])
  }, t.Editable.prototype.indent = function(e, i) {
    if (void 0 === i && (i = !0), this.browser.msie && t.Editable.getIEversion() < 9) return e ? this.document.execCommand("outdent", !1, !1) : this.document.execCommand("indent", !1, !1), !1;
    var n = 20;
    e && (n = -20), this.saveSelectionByMarkers(), this.wrapText(), this.restoreSelectionByMarkers();
    var s = this.getSelectionElements();
    this.saveSelectionByMarkers();
    for (var o = 0; o < s.length; o++) t(s[o]).parentsUntil(this.$element, "li").length > 0 && (s[o] = t(s[o]).closest("li").get(0));
    for (var r = 0; r < s.length; r++) {
      var a = t(s[r]);
      if (this.raiseEvent("indent", [a, e]))
        if (a.get(0) != this.$element.get(0)) {
          var l = parseInt(a.css("margin-left"), 10),
            h = Math.max(0, l + n);
          a.css("marginLeft", h), 0 === h && (a.css("marginLeft", ""), void 0 === a.css("style") && a.removeAttr("style"))
        } else {
          var c = t("<div>").html(a.html());
          a.html(c), c.css("marginLeft", Math.max(0, n)), 0 === Math.max(0, n) && (c.css("marginLeft", ""), void 0 === c.css("style") && c.removeAttr("style"))
        }
    }
    this.unwrapText(), this.restoreSelectionByMarkers(), i && this.repositionEditor(), e || this.triggerEvent("indent")
  }, t.Editable.prototype.outdent = function(t) { this.indent(!0, t), this.triggerEvent("outdent") }, t.Editable.prototype.execDefault = function(t, e) { this.saveUndoStep(), this.document.execCommand(t, !1, e), this.triggerEvent(t, [], !0, !0) }, t.Editable.prototype._startInDefault = function(t) { this.focus(), this.document.execCommand(t, !1, !1), this.refreshButtons() }, t.Editable.prototype._startInFontExec = function(e, i, n) {
    this.focus();
    try {
      var s = this.getRange(),
        o = s.cloneRange();
      o.collapse(!1);
      var r = t('<span data-inserted="true" data-fr-verified="true" style="' + e + ": " + n + ';">' + t.Editable.INVISIBLE_SPACE + "</span>", this.document);
      o.insertNode(r[0]), r = this.$element.find("[data-inserted]"), r.removeAttr("data-inserted"), this.setSelection(r.get(0), 1), null != i && this.triggerEvent(i, [n], !0, !0)
    } catch (a) {}
  }, t.Editable.prototype.removeFormat = function() { this.document.execCommand("removeFormat", !1, !1), this.document.execCommand("unlink", !1, !1), this.refreshButtons() }, t.Editable.prototype.inlineStyle = function(e, i, n) {
    if (this.browser.webkit) {
      var s = function(t) { return t.attr("style").indexOf("font-size") >= 0 };
      this.$element.find("[style]").each(function(e, i) {
        var n = t(i);
        s(n) && (n.attr("data-font-size", n.css("font-size")), n.css("font-size", ""))
      })
    }
    this.document.execCommand("fontSize", !1, 4), this.saveSelectionByMarkers(), this.browser.webkit && this.$element.find("[data-font-size]").each(function(e, i) {
      var n = t(i);
      n.css("font-size", n.attr("data-font-size")), n.removeAttr("data-font-size")
    });
    var o = function(i) {
      var s = t(i);
      s.css(e) != n && s.css(e, ""), "" === s.attr("style") && s.replaceWith(s.html())
    };
    this.$element.find("font").each(function(i, s) {
      var r = t('<span data-fr-verified="true" style="' + e + ": " + n + ';">' + t(s).html() + "</span>");
      t(s).replaceWith(r);
      for (var a = r.find("span"), l = a.length - 1; l >= 0; l--) o(a[l])
    }), this.removeBlankSpans(), this.restoreSelectionByMarkers(), this.repositionEditor(), null != i && this.triggerEvent(i, [n], !0, !0)
  }
}(jQuery),
function(t) {
  t.Editable.prototype.addListener = function(t, e) {
    var i = this._events,
      n = i[t] = i[t] || [];
    n.push(e)
  }, t.Editable.prototype.raiseEvent = function(t, e) {
    void 0 === e && (e = []);
    var i = !0,
      n = this._events[t];
    if (n)
      for (var s = 0, o = n.length; o > s; s++) {
        var r = n[s].apply(this, e);
        void 0 !== r && i !== !1 && (i = r)
      }
    return void 0 === i && (i = !0), i
  }
}(jQuery),
function(t) {
  t.Editable.prototype.start_marker = '<span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>', t.Editable.prototype.end_marker = '<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span>', t.Editable.prototype.markers_html = '<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span><span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>', t.Editable.prototype.text = function() { var t = ""; return this.window.getSelection ? t = this.window.getSelection() : this.document.getSelection ? t = this.document.getSelection() : this.document.selection && (t = this.document.selection.createRange().text), t.toString() }, t.Editable.prototype.selectionInEditor = function() {
    var e = this.getSelectionParent(),
      i = !1;
    return e == this.$element.get(0) && (i = !0), i === !1 && t(e).parents().each(t.proxy(function(t, e) { e == this.$element.get(0) && (i = !0) }, this)), i
  }, t.Editable.prototype.getSelection = function() { var t = ""; return t = this.window.getSelection ? this.window.getSelection() : this.document.getSelection ? this.document.getSelection() : this.document.selection.createRange() }, t.Editable.prototype.getRange = function() { var t = this.getRanges(); return t.length > 0 ? t[0] : null }, t.Editable.prototype.getRanges = function() { var t = this.getSelection(); if (t.getRangeAt && t.rangeCount) { for (var e = [], i = 0; i < t.rangeCount; i++) e.push(t.getRangeAt(i)); return e } return this.document.createRange ? [this.document.createRange()] : [] }, t.Editable.prototype.clearSelection = function() { var t = this.getSelection(); try { t.removeAllRanges ? t.removeAllRanges() : t.empty ? t.empty() : t.clear && t.clear() } catch (e) {} }, t.Editable.prototype.getSelectionElement = function() {
    var e = this.getSelection();
    if (e && e.rangeCount) {
      var i = this.getRange(),
        n = i.startContainer;
      if (1 == n.nodeType) {
        var s = !1;
        n.childNodes.length > 0 && n.childNodes[i.startOffset] && t(n.childNodes[i.startOffset]).text() === this.text() && (n = n.childNodes[i.startOffset], s = !0), !s && n.childNodes.length > 0 && t(n.childNodes[0]).text() === this.text() && ["BR", "IMG", "HR"].indexOf(n.childNodes[0].tagName) < 0 && (n = n.childNodes[0])
      }
      for (; 1 != n.nodeType && n.parentNode;) n = n.parentNode;
      for (var o = n; o && "BODY" != o.tagName;) {
        if (o == this.$element.get(0)) return n;
        o = t(o).parent()[0]
      }
    }
    return this.$element.get(0)
  }, t.Editable.prototype.getSelectionParent = function() { var e, i = null; return this.window.getSelection ? (e = this.window.getSelection(), e && e.rangeCount && (i = e.getRangeAt(0).commonAncestorContainer, 1 != i.nodeType && (i = i.parentNode))) : (e = this.document.selection) && "Control" != e.type && (i = e.createRange().parentElement()), null != i && (t.inArray(this.$element.get(0), t(i).parents()) >= 0 || i == this.$element.get(0)) ? i : null }, t.Editable.prototype.nodeInRange = function(t, e) {
    var i;
    if (t.intersectsNode) return t.intersectsNode(e);
    i = e.ownerthis.document.createRange();
    try { i.selectNode(e) } catch (n) { i.selectNodeContents(e) }
    return -1 == t.compareBoundaryPoints(Range.END_TO_START, i) && 1 == t.compareBoundaryPoints(Range.START_TO_END, i)
  }, t.Editable.prototype.getElementFromNode = function(e) { for (1 != e.nodeType && (e = e.parentNode); null !== e && this.valid_nodes.indexOf(e.tagName) < 0;) e = e.parentNode; return null != e && "LI" == e.tagName && t(e).find(this.valid_nodes.join(",")).not("li").length > 0 ? null : t.makeArray(t(e).parents()).indexOf(this.$element.get(0)) >= 0 ? e : null }, t.Editable.prototype.nextNode = function(t, e) { if (t.hasChildNodes()) return t.firstChild; for (; t && !t.nextSibling && t != e;) t = t.parentNode; return t && t != e ? t.nextSibling : null }, t.Editable.prototype.getRangeSelectedNodes = function(t) {
    var e = [],
      i = t.startContainer,
      n = t.endContainer;
    if (i == n && "TR" != i.tagName) { if (i.hasChildNodes() && 0 !== i.childNodes.length) { for (var s = i.childNodes, o = t.startOffset; o < t.endOffset; o++) s[o] && e.push(s[o]); return 0 === e.length && e.push(i), e } return [i] }
    if (i == n && "TR" == i.tagName) {
      var r = i.childNodes,
        a = t.startOffset;
      if (r.length > a && a >= 0) { var l = r[a]; if ("TD" == l.tagName || "TH" == l.tagName) return [l] }
    }
    for (; i && i != n;) i = this.nextNode(i, n), (i != n || t.endOffset > 0) && e.push(i);
    for (i = t.startContainer; i && i != t.commonAncestorContainer;) e.unshift(i), i = i.parentNode;
    return e
  }, t.Editable.prototype.getSelectedNodes = function() { if (this.window.getSelection) { var e = this.window.getSelection(); if (!e.isCollapsed) { for (var i = this.getRanges(), n = [], s = 0; s < i.length; s++) n = t.merge(n, this.getRangeSelectedNodes(i[s])); return n } if (this.selectionInEditor()) { var o = e.getRangeAt(0).startContainer; return 3 == o.nodeType ? [o.parentNode] : [o] } } return [] }, t.Editable.prototype.getSelectionElements = function() {
    var e = this.getSelectedNodes(),
      i = [];
    return t.each(e, t.proxy(function(t, e) {
      if (null !== e) {
        var n = this.getElementFromNode(e);
        i.indexOf(n) < 0 && n != this.$element.get(0) && null !== n && i.push(n)
      }
    }, this)), 0 === i.length && i.push(this.$element.get(0)), i
  }, t.Editable.prototype.getSelectionLink = function() { var e = this.getSelectionLinks(); return e.length > 0 ? t(e[0]).attr("href") : null }, t.Editable.prototype.saveSelection = function() { if (!this.selectionDisabled) { this.savedRanges = []; for (var t = this.getRanges(), e = 0; e < t.length; e++) this.savedRanges.push(t[e].cloneRange()) } }, t.Editable.prototype.restoreSelection = function() {
    if (!this.selectionDisabled) {
      var t, e, i = this.getSelection();
      if (this.savedRanges && this.savedRanges.length)
        for (i.removeAllRanges(), t = 0, e = this.savedRanges.length; e > t; t += 1) i.addRange(this.savedRanges[t]);
      this.savedRanges = null
    }
  }, t.Editable.prototype.insertMarkersAtPoint = function(t) {
    var e = t.clientX,
      i = t.clientY;
    this.removeMarkers();
    var n, s = null;
    if ("undefined" != typeof this.document.caretPositionFromPoint ? (n = this.document.caretPositionFromPoint(e, i), s = this.document.createRange(), s.setStart(n.offsetNode, n.offset), s.setEnd(n.offsetNode, n.offset)) : "undefined" != typeof this.document.caretRangeFromPoint && (n = this.document.caretRangeFromPoint(e, i), s = this.document.createRange(), s.setStart(n.startContainer, n.startOffset), s.setEnd(n.startContainer, n.startOffset)), null !== s && "undefined" != typeof this.window.getSelection) {
      var o = this.window.getSelection();
      o.removeAllRanges(), o.addRange(s)
    } else if ("undefined" != typeof this.document.body.createTextRange) try {
      s = this.document.body.createTextRange(), s.moveToPoint(e, i);
      var r = s.duplicate();
      r.moveToPoint(e, i), s.setEndPoint("EndToEnd", r), s.select()
    } catch (a) {} this.placeMarker(s, !0, 0), this.placeMarker(s, !1, 0)
  }, t.Editable.prototype.saveSelectionByMarkers = function() {
    if (!this.selectionDisabled) {
      this.selectionInEditor() || this.focus(), this.removeMarkers();
      for (var t = this.getRanges(), e = 0; e < t.length; e++)
        if (t[e].startContainer !== this.document) {
          var i = t[e];
          this.placeMarker(i, !0, e), this.placeMarker(i, !1, e)
        }
    }
  }, t.Editable.prototype.hasSelectionByMarkers = function() { var t = this.$element.find('.f-marker[data-type="true"]'); return t.length > 0 ? !0 : !1 }, t.Editable.prototype.restoreSelectionByMarkers = function(e) {
    if (void 0 === e && (e = !0), !this.selectionDisabled) {
      var i = this.$element.find('.f-marker[data-type="true"]');
      if (0 === i.length) return !1;
      this.$element.is(":focus") || this.browser.msie || this.$element.focus();
      var n = this.getSelection();
      (e || this.getRange() && !this.getRange().collapsed || !t(i[0]).attr("data-collapsed")) && (this.browser.msie && t.Editable.getIEversion() < 9 || (this.clearSelection(), e = !0));
      for (var s = 0; s < i.length; s++) {
        var o = t(i[s]).data("id"),
          r = i[s],
          a = this.$element.find('.f-marker[data-type="false"][data-id="' + o + '"]');
        if (this.browser.msie && t.Editable.getIEversion() < 9) return this.setSelection(r, 0, a, 0), this.removeMarkers(), !1;
        var l;
        if (l = e ? this.document.createRange() : this.getRange(), a.length > 0) { a = a[0]; try { l.setStartAfter(r), l.setEndBefore(a) } catch (h) {} } e && n.addRange(l)
      }
      this.removeMarkers()
    }
  }, t.Editable.prototype.setSelection = function(t, e, i, n) {
    var s = this.getSelection();
    if (s) {
      this.clearSelection();
      try {
        i || (i = t), void 0 === e && (e = 0), void 0 === n && (n = e);
        var o = this.getRange();
        o.setStart(t, e), o.setEnd(i, n), s.addRange(o)
      } catch (r) {}
    }
  }, t.Editable.prototype.buildMarker = function(e, i, n) { return void 0 === n && (n = ""), t('<span class="f-marker"' + n + ' style="display:none; line-height: 0;" data-fr-verified="true" data-id="' + i + '" data-type="' + e + '">', this.document)[0] }, t.Editable.prototype.placeMarker = function(e, i, n) {
    var s = "";
    e.collapsed && (s = ' data-collapsed="true"');
    try {
      var o = e.cloneRange();
      o.collapse(i);
      var r, a, l;
      if (o.insertNode(this.buildMarker(i, n, s)), i === !0 && s)
        for (r = this.$element.find('span.f-marker[data-type="true"][data-id="' + n + '"]').get(0).nextSibling; 3 === r.nodeType && 0 === r.data.length;) t(r).remove(), r = this.$element.find('span.f-marker[data-type="true"][data-id="' + n + '"]').get(0).nextSibling;
      if (i === !0 && "" === s && (l = this.$element.find('span.f-marker[data-type="true"][data-id="' + n + '"]').get(0), r = l.nextSibling, r && r.nodeType === Node.ELEMENT_NODE && this.valid_nodes.indexOf(r.tagName) >= 0)) {
        a = [r];
        do r = a[0], a = t(r).contents(); while (a[0] && this.valid_nodes.indexOf(a[0].tagName) >= 0);
        t(r).prepend(t(l))
      }
      if (i === !1 && "" === s && (l = this.$element.find('span.f-marker[data-type="false"][data-id="' + n + '"]').get(0), r = l.previousSibling, r && r.nodeType === Node.ELEMENT_NODE && this.valid_nodes.indexOf(r.tagName) >= 0)) {
        a = [r];
        do r = a[a.length - 1], a = t(r).contents(); while (a[a.length - 1] && this.valid_nodes.indexOf(a[a.length - 1].tagName) >= 0);
        t(r).append(t(l))
      }
    } catch (h) {}
  }, t.Editable.prototype.removeMarkers = function() { this.$element.find(".f-marker").remove() }, t.Editable.prototype.getSelectionTextInfo = function(t) {
    var e, i, n = !1,
      s = !1;
    if (this.window.getSelection) {
      var o = this.window.getSelection();
      o && o.rangeCount && (e = o.getRangeAt(0), i = e.cloneRange(), i.selectNodeContents(t), i.setEnd(e.startContainer, e.startOffset), n = "" === i.toString(), i.selectNodeContents(t), i.setStart(e.endContainer, e.endOffset), s = "" === i.toString())
    } else this.document.selection && "Control" != this.document.selection.type && (e = this.document.selection.createRange(), i = e.duplicate(), i.moveToElementText(t), i.setEndPoint("EndToStart", e), n = "" === i.text, i.moveToElementText(t), i.setEndPoint("StartToEnd", e), s = "" === i.text);
    return { atStart: n, atEnd: s }
  }, t.Editable.prototype.endsWith = function(t, e) { return -1 !== t.indexOf(e, t.length - e.length) }
}(jQuery),
function(t) {
  t.Editable.hexToRGB = function(t) {
    var e = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    t = t.replace(e, function(t, e, i, n) { return e + e + i + i + n + n });
    var i = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);
    return i ? { r: parseInt(i[1], 16), g: parseInt(i[2], 16), b: parseInt(i[3], 16) } : null
  }, t.Editable.hexToRGBString = function(t) { var e = this.hexToRGB(t); return e ? "rgb(" + e.r + ", " + e.g + ", " + e.b + ")" : "" }, t.Editable.RGBToHex = function(t) {
    function e(t) { return ("0" + parseInt(t, 10).toString(16)).slice(-2) }
    try { return t && "transparent" !== t ? /^#[0-9A-F]{6}$/i.test(t) ? t : (t = t.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/), ("#" + e(t[1]) + e(t[2]) + e(t[3])).toUpperCase()) : "" } catch (i) { return null }
  }, t.Editable.getIEversion = function() { var t, e, i = -1; return "Microsoft Internet Explorer" == navigator.appName ? (t = navigator.userAgent, e = new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})"), null !== e.exec(t) && (i = parseFloat(RegExp.$1))) : "Netscape" == navigator.appName && (t = navigator.userAgent, e = new RegExp("Trident/.*rv:([0-9]{1,}[\\.0-9]{0,})"), null !== e.exec(t) && (i = parseFloat(RegExp.$1))), i }, t.Editable.browser = function() {
    var t = {};
    if (this.getIEversion() > 0) t.msie = !0;
    else {
      var e = navigator.userAgent.toLowerCase(),
        i = /(chrome)[ \/]([\w.]+)/.exec(e) || /(webkit)[ \/]([\w.]+)/.exec(e) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(e) || /(msie) ([\w.]+)/.exec(e) || e.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(e) || [],
        n = { browser: i[1] || "", version: i[2] || "0" };
      i[1] && (t[n.browser] = !0), parseInt(n.version, 10) < 9 && t.msie && (t.oldMsie = !0), t.chrome ? t.webkit = !0 : t.webkit && (t.safari = !0)
    }
    return t
  }, t.Editable.isArray = function(t) { return t && !t.propertyIsEnumerable("length") && "object" == typeof t && "number" == typeof t.length }, t.Editable.uniq = function(e) { return t.grep(e, function(i, n) { return n == t.inArray(i, e) }) }, t.Editable.cleanWhitespace = function(e) { e.contents().filter(function() { return 1 == this.nodeType && t.Editable.cleanWhitespace(t(this)), 3 == this.nodeType && !/\S/.test(this.nodeValue) }).remove() }
}(jQuery),
function(t) {
  t.Editable.prototype.show = function(e) {
    if (this.hideDropdowns(), void 0 !== e) {
      if (this.options.inlineMode || this.options.editInPopup)
        if (null !== e && "touchend" !== e.type) {
          if (this.options.showNextToCursor) {
            var i = e.pageX,
              n = e.pageY;
            i < this.$element.offset().left && (i = this.$element.offset().left), i > this.$element.offset().left + this.$element.width() && (i = this.$element.offset().left + this.$element.width()), n < this.$element.offset.top && (n = this.$element.offset().top), n > this.$element.offset().top + this.$element.height() && (n = this.$element.offset().top + this.$element.height()), 20 > i && (i = 20), 0 > n && (n = 0), this.showByCoordinates(i, n)
          } else this.repositionEditor();
          t(".froala-editor:not(.f-basic)").hide(), this.$editor.show(), 0 !== this.options.buttons.length || this.options.editInPopup || this.$editor.hide()
        } else t(".froala-editor:not(.f-basic)").hide(), this.$editor.show(), this.repositionEditor();
      this.hidePopups(), this.options.editInPopup || this.showEditPopupWrapper(), this.$bttn_wrapper.show(), this.refreshButtons(), this.imageMode = !1
    }
  }, t.Editable.prototype.hideDropdowns = function() { this.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"), this.$bttn_wrapper.find(".fr-dropdown .fr-trigger") }, t.Editable.prototype.hide = function(t) { return this.initialized ? (void 0 === t && (t = !0), t ? this.hideOtherEditors() : (this.closeImageMode(), this.imageMode = !1), this.$popup_editor.hide(), this.hidePopups(!1), void(this.link = !1)) : !1 }, t.Editable.prototype.hideOtherEditors = function() { for (var e = 1; e <= t.Editable.count; e++) e != this._id && this.$window.trigger("hide." + e) }, t.Editable.prototype.hideBttnWrapper = function() { this.options.inlineMode && this.$bttn_wrapper.hide() }, t.Editable.prototype.showBttnWrapper = function() { this.options.inlineMode && this.$bttn_wrapper.show() }, t.Editable.prototype.showEditPopupWrapper = function() { this.$edit_popup_wrapper && (this.$edit_popup_wrapper.show(), setTimeout(t.proxy(function() { this.$edit_popup_wrapper.find("input").val(this.$element.text()).focus().select() }, this), 1)) }, t.Editable.prototype.hidePopups = function(t) { void 0 === t && (t = !0), t && this.hideBttnWrapper(), this.raiseEvent("hidePopups") }, t.Editable.prototype.showEditPopup = function() { this.showEditPopupWrapper() }
}(jQuery),
function(t) {
  t.Editable.prototype.getBoundingRect = function() {
    var e;
    if (this.isLink) {
      e = {};
      var i = this.$element;
      e.left = i.offset().left - this.$window.scrollLeft(), e.top = i.offset().top - this.$window.scrollTop(), e.width = i.outerWidth(), e.height = parseInt(i.css("padding-top").replace("px", ""), 10) + i.height(), e.right = 1, e.bottom = 1, e.ok = !0
    } else if (this.getRange() && this.getRange().collapsed) {
      var n = t(this.getSelectionElement());
      this.saveSelectionByMarkers();
      var s = this.$element.find(".f-marker:first");
      s.css("display", "inline");
      var o = s.offset();
      s.css("display", "none"), e = {}, e.left = o.left - this.$window.scrollLeft(), e.width = 0, e.height = (parseInt(n.css("line-height").replace("px", ""), 10) || 10) - 10 - this.$window.scrollTop(), e.top = o.top, e.right = 1, e.bottom = 1, e.ok = !0, this.removeMarkers()
    } else this.getRange() && (e = this.getRange().getBoundingClientRect());
    return e
  }, t.Editable.prototype.repositionEditor = function(t) {
    var e, i, n;
    if (this.options.inlineMode || t) {
      if (e = this.getBoundingRect(), this.showBttnWrapper(), e.ok || e.left >= 0 && e.top >= 0 && e.right > 0 && e.bottom > 0) i = e.left + e.width / 2, n = e.top + e.height, this.iOS() && this.iOSVersion() < 8 || (i += this.$window.scrollLeft(), n += this.$window.scrollTop()), this.showByCoordinates(i, n);
      else if (this.options.alwaysVisible) this.hide();
      else {
        var s = this.$element.offset();
        this.showByCoordinates(s.left, s.top + 10)
      }
      0 === this.options.buttons.length && this.hide()
    }
  }, t.Editable.prototype.showByCoordinates = function(t, e) {
    t -= 22, e += 8;
    var i = this.$document.find(this.options.scrollableContainer);
    "body" != this.options.scrollableContainer && (t -= i.offset().left, e -= i.offset().top, this.iPad() || (t += i.scrollLeft(), e += i.scrollTop()));
    var n = Math.max(this.$popup_editor.outerWidth(), 250);
    t + n >= i.outerWidth() - 50 && t + 44 - n > 0 ? (this.$popup_editor.addClass("right-side"), t = i.outerWidth() - (t + 44), "static" == i.css("position") && (t = t + parseFloat(i.css("margin-left"), 10) + parseFloat(i.css("margin-right"), 10)), this.$popup_editor.css("top", e), this.$popup_editor.css("right", t), this.$popup_editor.css("left", "auto")) : t + n < i.outerWidth() - 50 ? (this.$popup_editor.removeClass("right-side"), this.$popup_editor.css("top", e), this.$popup_editor.css("left", t), this.$popup_editor.css("right", "auto")) : (this.$popup_editor.removeClass("right-side"), this.$popup_editor.css("top", e), this.$popup_editor.css("left", Math.max(i.outerWidth() - n, 10) / 2), this.$popup_editor.css("right", "auto")), this.$popup_editor.show()
  }, t.Editable.prototype.positionPopup = function(e) {
    if (t(this.$editor.find('button.fr-bttn[data-cmd="' + e + '"]')).length) {
      var i = this.$editor.find('button.fr-bttn[data-cmd="' + e + '"]'),
        n = i.width(),
        s = i.height(),
        o = i.offset().left + n / 2,
        r = i.offset().top + s;
      this.showByCoordinates(o, r)
    }
  }
}(jQuery),
function(t) {
  t.Editable.prototype.refreshImageAlign = function(t) {
    this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");
    var e = "floatImageNone",
      i = "center";
    t.hasClass("fr-fil") ? (i = "left", e = "floatImageLeft") : t.hasClass("fr-fir") && (i = "right", e = "floatImageRight"), this.$image_editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class", "fa fa-align-" + i), this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="' + e + '"]').addClass("active")
  }, t.Editable.prototype.refreshImageDisplay = function() {
    var t = this.$element.find(".f-img-editor");
    this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li').removeClass("active"), t.hasClass("fr-dib") ? this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dib"]').addClass("active") : this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dii"]').addClass("active")
  }, t.Editable.image_commands = { align: { title: "Alignment", icon: "fa fa-align-center", refresh: t.Editable.prototype.refreshImageAlign, refreshOnShow: t.Editable.prototype.refreshImageAlign, seed: [{ cmd: "floatImageLeft", title: "Align Left", icon: "fa fa-align-left" }, { cmd: "floatImageNone", title: "Align Center", icon: "fa fa-align-center" }, { cmd: "floatImageRight", title: "Align Right", icon: "fa fa-align-right" }], callback: function(t, e, i) { this[i](t) }, undo: !0 }, display: { title: "Text Wrap", icon: "fa fa-star", refreshOnShow: t.Editable.prototype.refreshImageDisplay, namespace: "Image", seed: [{ title: "Inline", value: "fr-dii" }, { title: "Break Text", value: "fr-dib" }], callback: function(t, e, i) { this.displayImage(t, i) }, undo: !0 }, linkImage: { title: "Insert Link", icon: { type: "font", value: "fa fa-link" }, callback: function(t) { this.linkImage(t) } }, replaceImage: { title: "Replace Image", icon: { type: "font", value: "fa fa-exchange" }, callback: function(t) { this.replaceImage(t) } }, removeImage: { title: "Remove Image", icon: { type: "font", value: "fa fa-trash-o" }, callback: function(t) { this.removeImage(t) } } }, t.Editable.DEFAULTS = t.extend(t.Editable.DEFAULTS, { allowedImageTypes: ["jpeg", "jpg", "png", "gif"], customImageButtons: {}, defaultImageTitle: "Image title", defaultImageWidth: 300, defaultImageDisplay: "block", defaultImageAlignment: "center", imageButtons: ["display", "align", "linkImage", "replaceImage", "removeImage"], imageDeleteConfirmation: !0, imageDeleteURL: null, imageDeleteParams: {}, imageMove: !0, imageResize: !0, imageLink: !0, imageTitle: !0, imageUpload: !0, imageUploadParams: {}, imageUploadParam: "file", imageUploadToS3: !1, imageUploadURL: "http://i.froala.com/upload", maxImageSize: 10485760, pasteImage: !0, textNearImage: !0 }), t.Editable.prototype.hideImageEditorPopup = function() { this.$image_editor && this.$image_editor.hide() }, t.Editable.prototype.showImageEditorPopup = function() { this.$image_editor && this.$image_editor.show(), this.options.imageMove || this.$element.attr("contenteditable", !1) }, t.Editable.prototype.showImageWrapper = function() { this.$image_wrapper && this.$image_wrapper.show() }, t.Editable.prototype.hideImageWrapper = function(t) { this.$image_wrapper && (this.$element.attr("data-resize") || t || (this.closeImageMode(), this.imageMode = !1), this.$image_wrapper.hide(), this.$image_wrapper.find("input").blur()) }, t.Editable.prototype.showInsertImage = function() { this.hidePopups(), this.showImageWrapper() }, t.Editable.prototype.showImageEditor = function() { this.hidePopups(), this.showImageEditorPopup() }, t.Editable.prototype.insertImageHTML = function() { var e = '<div class="froala-popup froala-image-popup" style="display: none;"><h4><span data-text="true">Insert Image</span><span data-text="true">Uploading image</span><i title="Cancel" class="fa fa-times" id="f-image-close-' + this._id + '"></i></h4>'; return e += '<div id="f-image-list-' + this._id + '">', this.options.imageUpload && (e += '<div class="f-popup-line drop-upload">', e += '<div class="f-upload" id="f-upload-div-' + this._id + '"><strong data-text="true">Drop Image</strong><br>(<span data-text="true">or click</span>)<form target="frame-' + this._id + '" enctype="multipart/form-data" encoding="multipart/form-data" action="' + this.options.imageUploadURL + '" method="post" id="f-upload-form-' + this._id + '"><input id="f-file-upload-' + this._id + '" type="file" name="' + this.options.imageUploadParam + '" accept="image/*"></form></div>', this.browser.msie && t.Editable.getIEversion() <= 9 && (e += '<iframe id="frame-' + this._id + '" name="frame-' + this._id + '" src="javascript:false;" style="width:0; height:0; border:0px solid #FFF; position: fixed; z-index: -1;"></iframe>'), e += "</div>"), this.options.imageLink && (e += '<div class="f-popup-line"><label><span data-text="true">Enter URL</span>: </label><input id="f-image-url-' + this._id + '" type="text" placeholder="http://example.com"><button class="f-browse fr-p-bttn" id="f-browser-' + this._id + '"><i class="fa fa-search"></i></button><button data-text="true" class="f-ok fr-p-bttn f-submit" id="f-image-ok-' + this._id + '">OK</button></div>'), e += "</div>", e += '<p class="f-progress" id="f-progress-' + this._id + '"><span></span></p>', e += "</div>" }, t.Editable.prototype.iFrameLoad = function() {
    var t = this.$image_wrapper.find("iframe#frame-" + this._id);
    if (!t.attr("data-loaded")) return t.attr("data-loaded", !0), !1;
    try {
      var e = this.$image_wrapper.find("#f-upload-form-" + this._id);
      if (this.options.imageUploadToS3) {
        var i = e.attr("action"),
          n = e.find('input[name="key"]').val(),
          s = i + n;
        this.writeImage(s), this.options.imageUploadToS3.callback && this.options.imageUploadToS3.callback.call(this, s, n)
      } else {
        var o = t.contents().text();
        this.parseImageResponse(o)
      }
    } catch (r) { this.throwImageError(7) }
  }, t.Editable.prototype.initImage = function() { this.buildInsertImage(), (!this.isLink || this.isImage) && this.initImagePopup(), this.addListener("destroy", this.destroyImage) }, t.Editable.initializers.push(t.Editable.prototype.initImage), t.Editable.prototype.destroyImage = function() { this.$image_editor && this.$image_editor.html("").removeData().remove(), this.$image_wrapper && this.$image_wrapper.html("").removeData().remove() }, t.Editable.prototype.buildInsertImage = function() {
    this.$image_wrapper = t(this.insertImageHTML()), this.$popup_editor.append(this.$image_wrapper);
    var e = this;
    if (this.$image_wrapper.on("mouseup touchend", t.proxy(function(t) { this.isResizing() || t.stopPropagation() }, this)), this.addListener("hidePopups", t.proxy(function() { this.hideImageWrapper(!0) }, this)), this.$progress_bar = this.$image_wrapper.find("p#f-progress-" + this._id), this.options.imageUpload) {
      if (this.browser.msie && t.Editable.getIEversion() <= 9) {
        var i = this.$image_wrapper.find("iframe").get(0);
        i.attachEvent ? i.attachEvent("onload", function() { e.iFrameLoad() }) : i.onload = function() { e.iFrameLoad() }
      }
      this.$image_wrapper.on("change", 'input[type="file"]', function() {
        if (void 0 !== this.files) e.uploadImage(this.files);
        else {
          if (!e.triggerEvent("beforeImageUpload", [], !1)) return !1;
          var i = t(this).parents("form");
          i.find('input[type="hidden"]').remove();
          var n;
          for (n in e.options.imageUploadParams) i.prepend('<input type="hidden" name="' + n + '" value="' + e.options.imageUploadParams[n] + '" />');
          if (e.options.imageUploadToS3 !== !1) {
            for (n in e.options.imageUploadToS3.params) i.prepend('<input type="hidden" name="' + n + '" value="' + e.options.imageUploadToS3.params[n] + '" />');
            i.prepend('<input type="hidden" name="success_action_status" value="201" />'), i.prepend('<input type="hidden" name="X-Requested-With" value="xhr" />'), i.prepend('<input type="hidden" name="Content-Type" value="" />'), i.prepend('<input type="hidden" name="key" value="' + e.options.imageUploadToS3.keyStart + (new Date).getTime() + "-" + t(this).val().match(/[^\/\\]+$/) + '" />')
          } else i.prepend('<input type="hidden" name="XHR_CORS_TRARGETORIGIN" value="' + e.window.location.href + '" />');
          e.showInsertImage(), e.showImageLoader(!0), e.disable(), i.submit()
        }
        t(this).val("")
      })
    }
    this.buildDragUpload(), this.$image_wrapper.on("mouseup keydown", "#f-image-url-" + this._id, t.proxy(function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation()
    }, this)), this.$image_wrapper.on("click", "#f-image-ok-" + this._id, t.proxy(function() { this.writeImage(this.$image_wrapper.find("#f-image-url-" + this._id).val(), !0) }, this)), this.$image_wrapper.on(this.mouseup, "#f-image-close-" + this._id, t.proxy(function(t) { return this.isDisabled ? !1 : (t.stopPropagation(), this.$bttn_wrapper.show(), this.hideImageWrapper(!0), this.options.inlineMode && 0 === this.options.buttons.length && (this.imageMode ? this.showImageEditor() : this.hide()), this.imageMode || (this.restoreSelection(), this.focus()), void(this.options.inlineMode || this.imageMode ? this.imageMode && this.showImageEditor() : this.hide())) }, this)), this.$image_wrapper.on("click", function(t) { t.stopPropagation() }), this.$image_wrapper.on("click", "*", function(t) { t.stopPropagation() })
  }, t.Editable.prototype.deleteImage = function(e) {
    if (this.options.imageDeleteURL) {
      var i = this.options.imageDeleteParams;
      i.info = e.data("info"), i.src = e.attr("src"), t.ajax({ type: "POST", url: this.options.imageDeleteURL, data: i, crossDomain: this.options.crossDomain, xhrFields: { withCredentials: this.options.withCredentials }, headers: this.options.headers }).done(t.proxy(function(t) { e.parent().parent().hasClass("f-image-list") ? e.parent().remove() : e.parent().removeClass("f-img-deleting"), this.triggerEvent("imageDeleteSuccess", [t], !1) }, this)).fail(t.proxy(function() { e.parent().removeClass("f-img-deleting"), this.triggerEvent("imageDeleteError", ["Error during image delete."], !1) }, this))
    } else e.parent().removeClass("f-img-deleting"), this.triggerEvent("imageDeleteError", ["Missing imageDeleteURL option."], !1)
  }, t.Editable.prototype.imageHandle = function() {
    var e = this,
      i = t('<span data-fr-verified="true">').addClass("f-img-handle").on({
        movestart: function(i) { e.hide(), e.$element.addClass("f-non-selectable").attr("contenteditable", !1), e.$element.attr("data-resize", !0), t(this).attr("data-start-x", i.startX), t(this).attr("data-start-y", i.startY) },
        move: function(i) {
          var n = t(this),
            s = i.pageX - parseInt(n.attr("data-start-x"), 10);
          n.attr("data-start-x", i.pageX), n.attr("data-start-y", i.pageY);
          var o = n.prevAll("img"),
            r = o.width();
          n.hasClass("f-h-ne") || n.hasClass("f-h-se") ? o.attr("width", r + s) : o.attr("width", r - s), e.triggerEvent("imageResize", [o], !1)
        },
        moveend: function() {
          t(this).removeAttr("data-start-x"), t(this).removeAttr("data-start-y");
          var i = t(this),
            n = i.prevAll("img");
          e.$element.removeClass("f-non-selectable"), e.isImage || e.$element.attr("contenteditable", !0), e.triggerEvent("imageResizeEnd", [n]), t(this).trigger("mouseup")
        },
        touchend: function() { t(this).trigger("moveend") }
      });
    return i
  }, t.Editable.prototype.disableImageResize = function() { if (this.browser.mozilla) try { document.execCommand("enableObjectResizing", !1, !1), document.execCommand("enableInlineTableEditing", !1, !1) } catch (t) {} }, t.Editable.prototype.isResizing = function() { return this.$element.attr("data-resize") }, t.Editable.prototype.getImageStyle = function(t) {
    var e = "z-index: 1; position: relative; overflow: auto;",
      i = t,
      n = "padding";
    return t.parent().hasClass("f-img-editor") && (i = t.parent(), n = "margin"), e += " padding-left:" + i.css(n + "-left") + ";", e += " padding-right:" + i.css(n + "-right") + ";", e += " padding-bottom:" + i.css(n + "-bottom") + ";", e += " padding-top:" + i.css(n + "-top") + ";", t.hasClass("fr-dib") ? (e += " vertical-align: top; display: block;", e += t.hasClass("fr-fir") ? " float: none; margin-right: 0; margin-left: auto;" : t.hasClass("fr-fil") ? " float: none; margin-left: 0; margin-right: auto;" : " float: none; margin: auto;") : (e += " display: inline-block;", e += t.hasClass("fr-fir") ? " float: right;" : t.hasClass("fr-fil") ? " float: left;" : " float: none;"), e
  }, t.Editable.prototype.getImageClass = function(t) { var e = t.split(" "); return t = "fr-fin", e.indexOf("fr-fir") >= 0 && (t = "fr-fir"), e.indexOf("fr-fil") >= 0 && (t = "fr-fil"), e.indexOf("fr-dib") >= 0 && (t += " fr-dib"), e.indexOf("fr-dii") >= 0 && (t += " fr-dii"), t }, t.Editable.prototype.refreshImageButtons = function(t) {
    this.$image_editor.find("button").removeClass("active");
    var e = t.css("float");
    e = t.hasClass("fr-fil") ? "Left" : t.hasClass("fr-fir") ? "Right" : "None", this.$image_editor.find('button[data-cmd="floatImage' + e + '"]').addClass("active"), this.raiseEvent("refreshImage", [t])
  }, t.Editable.prototype.initImageEvents = function() {
    document.addEventListener && !document.dropAssigned && (document.dropAssigned = !0, document.addEventListener("drop", t.proxy(function(e) { return t(".froala-element img.fr-image-move").length ? (e.preventDefault(), e.stopPropagation(), t(".froala-element img.fr-image-move").removeClass("fr-image-move"), !1) : void 0 }, this))), this.disableImageResize();
    var e = this;
    this.$element.on("mousedown", 'img:not([contenteditable="false"])', function(i) { return e.isDisabled ? !1 : void(e.isResizing() || (e.initialized && i.stopPropagation(), e.$element.attr("contenteditable", !1), t(this).addClass("fr-image-move"))) }), this.$element.on("mouseup", 'img:not([contenteditable="false"])', function() { return e.isDisabled ? !1 : void(e.isResizing() || (e.options.imageMove || e.isImage || e.isHTML || e.$element.attr("contenteditable", !0), t(this).removeClass("fr-image-move"))) }), this.$element.on("click touchend", 'img:not([contenteditable="false"])', function(i) {
      if (e.isDisabled) return !1;
      if (!e.isResizing() && e.initialized) {
        if (i.preventDefault(), i.stopPropagation(), e.closeImageMode(), e.$element.blur(), e.refreshImageButtons(t(this)), e.$image_editor.find('.f-image-alt input[type="text"]').val(t(this).attr("alt") || t(this).attr("title")), e.showImageEditor(), !t(this).parent().hasClass("f-img-editor") || "SPAN" != t(this).parent().get(0).tagName) {
          var n = e.getImageClass(t(this).attr("class"));
          t(this).wrap('<span data-fr-verified="true" class="f-img-editor ' + n + '"></span>'), 0 !== t(this).parents(".f-img-wrap").length || e.isImage ? t(this).parents(".f-img-wrap").attr("class", n + " f-img-wrap") : t(this).parents("a").length > 0 ? t(this).parents("a:first").wrap('<span data-fr-verified="true" class="f-img-wrap ' + n + '"></span>') : t(this).parent().wrap('<span data-fr-verified="true" class="f-img-wrap ' + n + '"></span>')
        }
        if (t(this).parent().find(".f-img-handle").remove(), e.options.imageResize) {
          var s = e.imageHandle();
          t(this).parent().append(s.clone(!0).addClass("f-h-ne")), t(this).parent().append(s.clone(!0).addClass("f-h-se")), t(this).parent().append(s.clone(!0).addClass("f-h-sw")), t(this).parent().append(s.clone(!0).addClass("f-h-nw"))
        }
        e.showByCoordinates(t(this).offset().left + t(this).width() / 2, t(this).offset().top + t(this).height()), e.imageMode = !0, e.$bttn_wrapper.find(".fr-bttn").removeClass("active"), e.clearSelection()
      }
    }), this.$element.on("mousedown touchstart", ".f-img-handle", t.proxy(function() { return e.isDisabled ? !1 : void this.$element.attr("data-resize", !0) }, this)), this.$element.on("mouseup", ".f-img-handle", t.proxy(function(i) {
      if (e.isDisabled) return !1;
      var n = t(i.target).prevAll("img");
      setTimeout(t.proxy(function() { this.$element.removeAttr("data-resize"), n.click() }, this), 0)
    }, this))
  }, t.Editable.prototype.execImage = function(e, i, n) {
    var s = this.$element.find("span.f-img-editor"),
      o = s.find("img"),
      r = t.Editable.image_commands[e] || this.options.customImageButtons[e];
    r && r.callback && r.callback.apply(this, [o, e, i, n])
  }, t.Editable.prototype.bindImageRefreshListener = function(e) { e.refresh && this.addListener("refreshImage", t.proxy(function(t) { e.refresh.apply(this, [t]) }, this)) }, t.Editable.prototype.buildImageButton = function(t, e) { var i = '<button class="fr-bttn" data-namespace="Image" data-cmd="' + e + '" title="' + t.title + '">'; return i += void 0 !== this.options.icons[e] ? this.prepareIcon(this.options.icons[e], t.title) : this.prepareIcon(t.icon, t.title), i += "</button>", this.bindImageRefreshListener(t), i }, t.Editable.prototype.buildImageAlignDropdown = function(t) {
    this.bindImageRefreshListener(t);
    for (var e = '<ul class="fr-dropdown-menu f-align">', i = 0; i < t.seed.length; i++) {
      var n = t.seed[i];
      e += '<li data-cmd="align" data-namespace="Image" data-val="' + n.cmd + '" title="' + n.title + '"><a href="#"><i class="' + n.icon + '"></i></a></li>'
    }
    return e += "</ul>"
  }, t.Editable.prototype.buildImageDropdown = function(t) { return dropdown = this.buildDefaultDropdown(t), btn = this.buildDropdownButton(t, dropdown), btn }, t.Editable.prototype.image_command_dispatcher = {
    align: function(t) {
      var e = this.buildImageAlignDropdown(t),
        i = this.buildDropdownButton(t, e);
      return i
    }
  }, t.Editable.prototype.buildImageButtons = function() {
    for (var e = "", i = 0; i < this.options.imageButtons.length; i++) {
      var n = this.options.imageButtons[i];
      if (void 0 !== t.Editable.image_commands[n] || void 0 !== this.options.customImageButtons[n]) {
        var s = t.Editable.image_commands[n] || this.options.customImageButtons[n];
        s.cmd = n;
        var o = this.image_command_dispatcher[n];
        e += o ? o.apply(this, [s]) : s.seed ? this.buildImageDropdown(s, n) : this.buildImageButton(s, n)
      }
    }
    return e
  }, t.Editable.prototype.initImagePopup = function() {
    this.$image_editor = t('<div class="froala-popup froala-image-editor-popup" style="display: none">');
    var e = t('<div class="f-popup-line f-popup-toolbar">').appendTo(this.$image_editor);
    e.append(this.buildImageButtons()), this.addListener("hidePopups", this.hideImageEditorPopup), this.options.imageTitle && t('<div class="f-popup-line f-image-alt">').append('<label><span data-text="true">Title</span>: </label>').append(t('<input type="text">').on("mouseup keydown touchend", function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation()
    })).append('<button class="fr-p-bttn f-ok" data-text="true" data-callback="setImageAlt" data-cmd="setImageAlt" title="OK">OK</button>').appendTo(this.$image_editor), this.$popup_editor.append(this.$image_editor), this.bindCommandEvents(this.$image_editor), this.bindDropdownEvents(this.$image_editor)
  }, t.Editable.prototype.displayImage = function(t, e) {
    var i = t.parents("span.f-img-editor");
    i.removeClass("fr-dii fr-dib").addClass(e), this.triggerEvent("imageDisplayed", [t, e]), t.click()
  }, t.Editable.prototype.floatImageLeft = function(t) {
    var e = t.parents("span.f-img-editor");
    e.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fil"), this.isImage && this.$element.css("float", "left"), this.triggerEvent("imageFloatedLeft", [t]), t.click()
  }, t.Editable.prototype.floatImageNone = function(t) {
    var e = t.parents("span.f-img-editor");
    e.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fin"), this.isImage || (e.parent().get(0) == this.$element.get(0) ? e.wrap('<div style="text-align: center;"></div>') : e.parents(".f-img-wrap:first").css("text-align", "center")), this.isImage && this.$element.css("float", "none"), this.triggerEvent("imageFloatedNone", [t]), t.click()
  }, t.Editable.prototype.floatImageRight = function(t) {
    var e = t.parents("span.f-img-editor");
    e.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fir"), this.isImage && this.$element.css("float", "right"), this.triggerEvent("imageFloatedRight", [t]), t.click()
  }, t.Editable.prototype.linkImage = function(t) { this.imageMode = !0, this.showInsertLink(); var e = t.parents("span.f-img-editor"); "A" == e.parent().get(0).tagName ? this.updateLinkValues(e.parent()) : this.resetLinkValues() }, t.Editable.prototype.replaceImage = function(t) { this.showInsertImage(), this.imageMode = !0, this.$image_wrapper.find('input[type="text"]').val(t.attr("src")), this.showByCoordinates(t.offset().left + t.width() / 2, t.offset().top + t.height()) }, t.Editable.prototype.removeImage = function(e) {
    var i = e.parents("span.f-img-editor");
    if (0 === i.length) return !1;
    var n = e.get(0),
      s = "Are you sure? Image will be deleted.";
    if (t.Editable.LANGS[this.options.language] && (s = t.Editable.LANGS[this.options.language].translation[s]), !this.options.imageDeleteConfirmation || confirm(s)) {
      if (this.triggerEvent("beforeRemoveImage", [t(n)], !1)) {
        var o = i.parents(this.valid_nodes.join(","));
        i.parents(".f-img-wrap").length ? i.parents(".f-img-wrap").remove() : i.remove(), this.refreshImageList(!0), this.hide(), o.length && o[0] != this.$element.get(0) && "" === t(o[0]).text() && 1 == o[0].childNodes.length && t(o[0]).remove(), this.wrapText(), this.triggerEvent("afterRemoveImage", [e]), this.focus(), this.imageMode = !1
      }
    } else e.click()
  }, t.Editable.prototype.setImageAlt = function() {
    var t = this.$element.find("span.f-img-editor"),
      e = t.find("img");
    e.attr("alt", this.$image_editor.find('.f-image-alt input[type="text"]').val()), e.attr("title", this.$image_editor.find('.f-image-alt input[type="text"]').val()), this.hide(), this.closeImageMode(), this.triggerEvent("imageAltSet", [e])
  }, t.Editable.prototype.buildImageMove = function() {
    var e = this;
    this.isLink || this.initDrag(), e.$element.on("dragover dragenter dragend", function(t) { t.preventDefault() }), e.$element.on("drop", function(i) {
      if (e.isDisabled) return !1;
      if (e.closeImageMode(), e.hide(), e.imageMode = !1, e.initialized || (e.$element.unbind("mousedown.element"), e.lateInit()), !e.options.imageUpload || 0 !== t(".froala-element img.fr-image-move").length) {
        if (t(".froala-element .fr-image-move").length > 0 && e.options.imageMove) {
          i.preventDefault(), i.stopPropagation(), e.insertMarkersAtPoint(i.originalEvent), e.restoreSelectionByMarkers();
          var n = t("<div>").append(t(".froala-element img.fr-image-move").clone().removeClass("fr-image-move").addClass("fr-image-dropped")).html();
          e.insertHTML(n);
          var s = t(".froala-element img.fr-image-move").parent();
          t(".froala-element img.fr-image-move").remove(), s.get(0) != e.$element.get(0) && s.is(":empty") && s.remove(), e.clearSelection(), e.initialized ? setTimeout(function() { e.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped").click() }, 0) : e.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped"), e.sync(), e.hideOtherEditors()
        } else i.preventDefault(), i.stopPropagation(), t(".froala-element img.fr-image-move").removeClass("fr-image-move");
        return !1
      }
      if (i.originalEvent.dataTransfer && i.originalEvent.dataTransfer.files && i.originalEvent.dataTransfer.files.length) {
        if (e.isDisabled) return !1;
        var o = i.originalEvent.dataTransfer.files;
        e.options.allowedImageTypes.indexOf(o[0].type.replace(/image\//g, "")) >= 0 && (e.insertMarkersAtPoint(i.originalEvent), e.showByCoordinates(i.originalEvent.pageX, i.originalEvent.pageY), e.uploadImage(o), i.preventDefault(), i.stopPropagation())
      }
    })
  }, t.Editable.prototype.buildDragUpload = function() {
    var e = this;
    e.$image_wrapper.on("dragover", "#f-upload-div-" + this._id, function() { return t(this).addClass("f-hover"), !1 }), e.$image_wrapper.on("dragend", "#f-upload-div-" + this._id, function() { return t(this).removeClass("f-hover"), !1 }), e.$image_wrapper.on("drop", "#f-upload-div-" + this._id, function(i) { return i.preventDefault(), i.stopPropagation(), e.options.imageUpload ? (t(this).removeClass("f-hover"), void e.uploadImage(i.originalEvent.dataTransfer.files)) : !1 })
  }, t.Editable.prototype.showImageLoader = function(e) {
    if (void 0 === e && (e = !1), e) {
      var i = "Please wait!";
      t.Editable.LANGS[this.options.language] && (i = t.Editable.LANGS[this.options.language].translation[i]), this.$progress_bar.find("span").css("width", "100%").text(i)
    } else this.$image_wrapper.find("h4").addClass("uploading");
    this.$image_wrapper.find("#f-image-list-" + this._id).hide(), this.$progress_bar.show(), this.showInsertImage()
  }, t.Editable.prototype.hideImageLoader = function() { this.$progress_bar.hide(), this.$progress_bar.find("span").css("width", "0%").text(""), this.$image_wrapper.find("#f-image-list-" + this._id).show(), this.$image_wrapper.find("h4").removeClass("uploading") }, t.Editable.prototype.writeImage = function(e, i, n) {
    if (i && (e = this.sanitizeURL(e), "" === e)) return !1;
    var s = new Image;
    s.onerror = t.proxy(function() { this.hideImageLoader(), this.throwImageError(1) }, this), s.onload = this.imageMode ? t.proxy(function() {
      var t = this.$element.find(".f-img-editor > img");
      t.attr("src", e), this.hide(), this.hideImageLoader(), this.$image_editor.show(), this.enable(), this.triggerEvent("imageReplaced", [t, n]), setTimeout(function() { t.trigger("click") }, 0)
    }, this) : t.proxy(function() { this.insertLoadedImage(e, n) }, this), this.showImageLoader(!0), s.src = e
  }, t.Editable.prototype.processInsertImage = function(e, i) {
    void 0 === i && (i = !0), this.enable(), this.focus(), this.restoreSelection();
    var n = "";
    parseInt(this.options.defaultImageWidth, 10) && (n = ' width="' + this.options.defaultImageWidth + '"');
    var s = "fr-fin";
    "left" == this.options.defaultImageAlignment && (s = "fr-fil"), "right" == this.options.defaultImageAlignment && (s = "fr-fir"), s += " fr-di" + this.options.defaultImageDisplay[0];
    var o = '<img class="' + s + ' fr-just-inserted" alt="' + this.options.defaultImageTitle + '" src="' + e + '"' + n + ">",
      r = this.getSelectionElements()[0],
      a = this.getRange(),
      l = !this.browser.msie && t.Editable.getIEversion() > 8 ? t(a.startContainer) : null;
    l && l.hasClass("f-img-wrap") ? (1 === a.startOffset ? (l.after("<" + this.options.defaultTag + '><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></' + this.options.defaultTag + ">"), this.restoreSelectionByMarkers(), this.getSelection().collapseToStart()) : 0 === a.startOffset && (l.before("<" + this.options.defaultTag + '><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></' + this.options.defaultTag + ">"), this.restoreSelectionByMarkers(), this.getSelection().collapseToStart()), this.insertHTML(o)) : this.getSelectionTextInfo(r).atStart && r != this.$element.get(0) && "TD" != r.tagName && "TH" != r.tagName && "LI" != r.tagName ? t(r).before("<" + this.options.defaultTag + ">" + o + "</" + this.options.defaultTag + ">") : this.insertHTML(o), this.disable()
  }, t.Editable.prototype.insertLoadedImage = function(e, i) {
    this.triggerEvent("imageLoaded", [e], !1), this.processInsertImage(e, !1), this.browser.msie && this.$element.find("img").each(function(t, e) { e.oncontrolselect = function() { return !1 } }), this.enable(), this.hide(), this.hideImageLoader(), this.wrapText(), this.cleanupLists();
    var n, s = this.$element.find("img.fr-just-inserted").get(0);
    s && (n = s.previousSibling), n && 3 == n.nodeType && /\u200B/gi.test(n.textContent) && t(n).remove(), this.triggerEvent("imageInserted", [this.$element.find("img.fr-just-inserted"), i]), setTimeout(t.proxy(function() { this.$element.find("img.fr-just-inserted").removeClass("fr-just-inserted").trigger("touchend") }, this), 50)
  }, t.Editable.prototype.throwImageErrorWithMessage = function(t) { this.enable(), this.triggerEvent("imageError", [{ message: t, code: 0 }], !1), this.hideImageLoader() }, t.Editable.prototype.throwImageError = function(t) {
    this.enable();
    var e = "Unknown image upload error.";
    1 == t ? e = "Bad link." : 2 == t ? e = "No link in upload response." : 3 == t ? e = "Error during file upload." : 4 == t ? e = "Parsing response failed." : 5 == t ? e = "Image too large." : 6 == t ? e = "Invalid image type." : 7 == t && (e = "Image can be uploaded only to same domain in IE 8 and IE 9."), this.triggerEvent("imageError", [{ code: t, message: e }], !1), this.hideImageLoader()
  }, t.Editable.prototype.uploadImage = function(e) {
    if (!this.triggerEvent("beforeImageUpload", [e], !1)) return !1;
    if (void 0 !== e && e.length > 0) {
      var i;
      if (this.drag_support.formdata && (i = this.drag_support.formdata ? new FormData : null), i) {
        var n;
        for (n in this.options.imageUploadParams) i.append(n, this.options.imageUploadParams[n]);
        if (this.options.imageUploadToS3 !== !1) {
          for (n in this.options.imageUploadToS3.params) i.append(n, this.options.imageUploadToS3.params[n]);
          i.append("success_action_status", "201"), i.append("X-Requested-With", "xhr"), i.append("Content-Type", e[0].type), i.append("key", this.options.imageUploadToS3.keyStart + (new Date).getTime() + "-" + e[0].name)
        }
        if (i.append(this.options.imageUploadParam, e[0]), e[0].size > this.options.maxImageSize) return this.throwImageError(5), !1;
        if (this.options.allowedImageTypes.indexOf(e[0].type.replace(/image\//g, "")) < 0) return this.throwImageError(6), !1
      }
      if (i) {
        var s;
        if (this.options.crossDomain) s = this.createCORSRequest("POST", this.options.imageUploadURL);
        else { s = new XMLHttpRequest, s.open("POST", this.options.imageUploadURL); for (var o in this.options.headers) s.setRequestHeader(o, this.options.headers[o]) } s.onload = t.proxy(function() {
          var e = "Please wait!";
          t.Editable.LANGS[this.options.language] && (e = t.Editable.LANGS[this.options.language].translation[e]), this.$progress_bar.find("span").css("width", "100%").text(e);
          try {
            if (this.options.imageUploadToS3) 201 == s.status ? this.parseImageResponseXML(s.responseXML) : this.throwImageError(3);
            else if (s.status >= 200 && s.status < 300) this.parseImageResponse(s.responseText);
            else try {
              var i = t.parseJSON(s.responseText);
              i.error ? this.throwImageErrorWithMessage(i.error) : this.throwImageError(3)
            } catch (n) { this.throwImageError(3) }
          } catch (n) { this.throwImageError(4) }
        }, this), s.onerror = t.proxy(function() { this.throwImageError(3) }, this), s.upload.onprogress = t.proxy(function(t) {
          if (t.lengthComputable) {
            var e = t.loaded / t.total * 100 | 0;
            this.$progress_bar.find("span").css("width", e + "%")
          }
        }, this), this.disable(), s.send(i), this.showImageLoader()
      }
    }
  }, t.Editable.prototype.parseImageResponse = function(e) {
    try {
      if (!this.triggerEvent("afterImageUpload", [e], !1)) return !1;
      var i = t.parseJSON(e);
      i.link ? this.writeImage(i.link, !1, e) : i.error ? this.throwImageErrorWithMessage(i.error) : this.throwImageError(2)
    } catch (n) { this.throwImageError(4) }
  }, t.Editable.prototype.parseImageResponseXML = function(e) {
    try {
      var i = t(e).find("Location").text(),
        n = t(e).find("Key").text();
      this.options.imageUploadToS3.callback && this.options.imageUploadToS3.callback.call(this, i, n), i ? this.writeImage(i) : this.throwImageError(2)
    } catch (s) { this.throwImageError(4) }
  }, t.Editable.prototype.setImageUploadURL = function(t) { t && (this.options.imageUploadURL = t), this.options.imageUploadToS3 && (this.options.imageUploadURL = "https://" + this.options.imageUploadToS3.bucket + "." + this.options.imageUploadToS3.region + ".amazonaws.com/") }, t.Editable.prototype.closeImageMode = function() { this.$element.find("span.f-img-editor > img").each(t.proxy(function(e, i) { t(i).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(t(i).parent().attr("class"))), t(i).parents(".f-img-wrap").length > 0 ? "A" == t(i).parent().parent().get(0).tagName ? t(i).siblings("span.f-img-handle").remove().end().unwrap().parent().unwrap() : t(i).siblings("span.f-img-handle").remove().end().unwrap().unwrap() : t(i).siblings("span.f-img-handle").remove().end().unwrap() }, this)), this.$element.find("span.f-img-editor").length && (this.$element.find("span.f-img-editor").remove(), this.$element.parents("span.f-img-editor").remove()), this.$element.removeClass("f-non-selectable"), this.editableDisabled || this.isHTML || this.$element.attr("contenteditable", !0), this.$image_editor && this.$image_editor.hide(), this.$link_wrapper && this.options.linkText && this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden") }, t.Editable.prototype.refreshImageList = function(e) {
    if (!this.isLink && !this.options.editInPopup) {
      var i = [],
        n = [],
        s = this;
      if (this.$element.find("img").each(function(e, o) {
          var r = t(o);
          if (i.push(r.attr("src")), n.push(r), "false" == r.attr("contenteditable")) return !0;
          if (0 !== r.parents(".f-img-editor").length || r.hasClass("fr-dii") || r.hasClass("fr-dib") || (s.options.textNearImage ? r.addClass(r.hasClass("fr-fin") ? "fr-dib" : r.hasClass("fr-fil") || r.hasClass("fr-fir") ? "fr-dii" : "block" == r.css("display") && "none" == r.css("float") ? "fr-dib" : "fr-dii") : (r.addClass("fr-dib"), s.options.imageButtons.splice(s.options.imageButtons.indexOf("display"), 1))), s.options.textNearImage || r.removeClass("fr-dii").addClass("fr-dib"), 0 === r.parents(".f-img-editor").length && !r.hasClass("fr-fil") && !r.hasClass("fr-fir") && !r.hasClass("fr-fin"))
            if (r.hasClass("fr-dii")) r.addClass("right" == r.css("float") ? "fr-fir" : "left" == r.css("float") ? "fr-fil" : "fr-fin");
            else {
              var a = r.attr("style");
              r.hide(), r.addClass(0 === parseInt(r.css("margin-right"), 10) && a ? "fr-fir" : 0 === parseInt(r.css("margin-left"), 10) && a ? "fr-fil" : "fr-fin"), r.show()
            }
          r.css("margin", ""), r.css("float", ""), r.css("display", ""), r.removeAttr("data-style")
        }), void 0 === e)
        for (var o = 0; o < this.imageList.length; o++) i.indexOf(this.imageList[o].attr("src")) < 0 && this.triggerEvent("afterRemoveImage", [this.imageList[o]], !1);
      this.imageList = n
    }
  }, t.Editable.prototype.insertImage = function() { this.options.inlineMode || (this.closeImageMode(), this.imageMode = !1, this.positionPopup("insertImage")), this.selectionInEditor() && this.saveSelection(), this.showInsertImage(), this.imageMode = !1, this.$image_wrapper.find('input[type="text"]').val("") }
}(jQuery),
function(t) {
  t.Editable.prototype.showLinkWrapper = function() { this.$link_wrapper && (this.$link_wrapper.show(), this.$link_wrapper.trigger("hideLinkList"), this.$link_wrapper.trigger("hideLinkClassList"), this.$link_wrapper.find("input.f-lu").removeClass("fr-error"), this.imageMode || !this.options.linkText ? this.$link_wrapper.find('input[type="text"].f-lt').parent().addClass("fr-hidden") : this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden"), this.imageMode && this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"), this.phone() ? this.$document.scrollTop(this.$link_wrapper.offset().top + 30) : setTimeout(t.proxy(function() { this.imageMode && this.iPad() || this.$link_wrapper.find('input[type="text"].f-lu').focus().select() }, this), 0), this.link = !0), this.refreshDisabledState() }, t.Editable.prototype.hideLinkWrapper = function() { this.$link_wrapper && (this.$link_wrapper.hide(), this.$link_wrapper.find("input").blur()), this.refreshDisabledState() }, t.Editable.prototype.showInsertLink = function() { this.hidePopups(), this.showLinkWrapper() }, t.Editable.prototype.updateLinkValues = function(e) {
    var i = e.attr("href") || "http://";
    this.$link_wrapper.find("input.f-lt").val(e.text()), this.isLink ? ("#" == i && (i = ""), this.$link_wrapper.find("input#f-lu-" + this._id).val(i.replace(/\&amp;/g, "&")), this.$link_wrapper.find(".f-external-link").attr("href", i || "#")) : (this.$link_wrapper.find("input.f-lu").val(i.replace(/\&amp;/g, "&")), this.$link_wrapper.find(".f-external-link").attr("href", i)), this.$link_wrapper.find("input.f-target").prop("checked", "_blank" == e.attr("target")), this.$link_wrapper.find("li.f-choose-link-class").each(t.proxy(function(i, n) { e.hasClass(t(n).data("class")) && t(n).click() }, this));
    for (var n in this.options.linkAttributes) {
      var s = e.attr(n);
      this.$link_wrapper.find("input.fl-" + n).val(s ? s : "")
    }
    this.$link_wrapper.find("a.f-external-link, button.f-unlink").show()
  }, t.Editable.prototype.initLinkEvents = function() {
    var e = this,
      i = function(t) { t.stopPropagation(), t.preventDefault() },
      n = function(i) { return i.stopPropagation(), i.preventDefault(), e.isDisabled ? !1 : "" !== e.text() ? (e.hide(), !1) : (e.link = !0, e.clearSelection(), e.removeMarkers(), e.selectionDisabled || (t(this).before('<span class="f-marker" data-type="true" data-id="0" data-fr-verified="true"></span>'), t(this).after('<span class="f-marker" data-type="false" data-id="0" data-fr-verified="true"></span>'), e.restoreSelectionByMarkers()), e.exec("createLink"), e.updateLinkValues(t(this)), e.showByCoordinates(t(this).offset().left + t(this).outerWidth() / 2, t(this).offset().top + (parseInt(t(this).css("padding-top"), 10) || 0) + t(this).height()), e.showInsertLink(), t(this).hasClass("fr-file") ? e.$link_wrapper.find("input.f-lu").attr("disabled", "disabled") : e.$link_wrapper.find("input.f-lu").removeAttr("disabled"), void e.closeImageMode()) };
    this.$element.on("mousedown", "a", t.proxy(function(t) { this.isResizing() || t.stopPropagation() }, this)), this.isLink ? this.iOS() ? (this.$element.on("touchstart", i), this.$element.on("touchend", n)) : this.$element.on("click", n) : this.iOS() ? (this.$element.on("touchstart", 'a:not([contenteditable="false"])', i), this.$element.on("touchend", 'a:not([contenteditable="false"])', n), this.$element.on("touchstart", 'a[contenteditable="false"]', i), this.$element.on("touchend", 'a[contenteditable="false"]', i)) : (this.$element.on("click", 'a:not([contenteditable="false"])', n), this.$element.on("click", 'a[contenteditable="false"]', i))
  }, t.Editable.prototype.destroyLink = function() { this.$link_wrapper.html("").removeData().remove() }, t.Editable.prototype.initLink = function() { this.buildCreateLink(), this.initLinkEvents(), this.addListener("destroy", this.destroyLink) }, t.Editable.initializers.push(t.Editable.prototype.initLink), t.Editable.prototype.removeLink = function() { this.imageMode ? ("A" == this.$element.find(".f-img-editor").parent().get(0).tagName && t(this.$element.find(".f-img-editor").get(0)).unwrap(), this.triggerEvent("imageLinkRemoved"), this.showImageEditor(), this.$element.find(".f-img-editor").find("img").click(), this.link = !1) : (this.restoreSelection(), this.document.execCommand("unlink", !1, null), this.isLink || this.$element.find("a:empty").remove(), this.triggerEvent("linkRemoved"), this.hideLinkWrapper(), this.$bttn_wrapper.show(), (!this.options.inlineMode || this.isLink) && this.hide(), this.link = !1) }, t.Editable.prototype.writeLink = function(e, i, n, s, o) {
    var r, a = this.options.noFollow;
    this.options.alwaysBlank && (s = !0);
    var l, h = "",
      c = "",
      d = "";
    a === !0 && /^https?:\/\//.test(e) && (h = 'rel="nofollow"'), s === !0 && (c = 'target="_blank"');
    for (l in o) d += " " + l + '="' + o[l] + '"';
    var u = e;
    if (e = this.sanitizeURL(e), this.options.convertMailAddresses) {
      var p = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/i;
      p.test(e) && 0 !== e.indexOf("mailto:") && (e = "mailto:" + e)
    }
    if (0 === e.indexOf("mailto:") || "" === this.options.linkAutoPrefix || /^(https?:|ftps?:|)\/\//.test(e) || (e = this.options.linkAutoPrefix + e), "" === e) return this.$link_wrapper.find("input.f-lu").addClass("fr-error").focus(), this.triggerEvent("badLink", [u], !1), !1;
    if (this.$link_wrapper.find("input.f-lu").removeClass("fr-error"), this.imageMode) {
      if ("A" != this.$element.find(".f-img-editor").parent().get(0).tagName) this.$element.find(".f-img-editor").wrap('<a data-fr-link="true" href="' + e + '" ' + c + " " + h + d + "></a>");
      else {
        var f = this.$element.find(".f-img-editor").parent();
        s === !0 ? f.attr("target", "_blank") : f.removeAttr("target"), a === !0 ? f.attr("rel", "nofollow") : f.removeAttr("rel");
        for (l in o) o[l] ? f.attr(l, o[l]) : f.removeAttr(l);
        f.removeClass(Object.keys(this.options.linkClasses).join(" ")), f.attr("href", e).addClass(n)
      }
      this.triggerEvent("imageLinkInserted", [e]), this.showImageEditor(), this.$element.find(".f-img-editor").find("img").click(), this.link = !1
    } else {
      var m = null;
      this.isLink ? "" === i && (i = this.$element.text()) : (this.restoreSelection(), r = this.getSelectionLinks(), r.length > 0 && (m = r[0].attributes, is_file = t(r[0]).hasClass("fr-file")), this.saveSelectionByMarkers(), this.document.execCommand("unlink", !1, e), this.$element.find('span[data-fr-link="true"]').each(function(e, i) { t(i).replaceWith(t(i).html()) }), this.restoreSelectionByMarkers()), this.isLink ? (this.$element.text(i), r = [this.$element.attr("href", e).get(0)]) : (this.removeMarkers(), (this.options.linkText || "" === this.text()) && (this.insertHTML('<span class="f-marker" data-fr-verified="true" data-id="0" data-type="true"></span>' + (i || this.clean(u)) + '<span class="f-marker" data-fr-verified="true" data-id="0" data-type="false"></span>'), this.restoreSelectionByMarkers()), this.document.execCommand("createLink", !1, e), r = this.getSelectionLinks());
      for (var g = 0; g < r.length; g++) {
        if (m)
          for (var v = 0; v < m.length; v++) "href" != m[v].nodeName && t(r[g]).attr(m[v].nodeName, m[v].value);
        s === !0 ? t(r[g]).attr("target", "_blank") : t(r[g]).removeAttr("target"), a === !0 && /^https?:\/\//.test(e) ? t(r[g]).attr("rel", "nofollow") : t(r[g]).removeAttr("rel"), t(r[g]).data("fr-link", !0), t(r[g]).removeClass(Object.keys(this.options.linkClasses).join(" ")), t(r[g]).addClass(n);
        for (l in o) o[l] ? t(r[g]).attr(l, o[l]) : t(r[g]).removeAttr(l)
      }
      this.$element.find("a:empty").remove(), this.triggerEvent("linkInserted", [e]), this.hideLinkWrapper(), this.$bttn_wrapper.show(), (!this.options.inlineMode || this.isLink) && this.hide(), this.link = !1
    }
  }, t.Editable.prototype.createLinkHTML = function() {
    var t = '<div class="froala-popup froala-link-popup" style="display: none;">';
    t += '<h4><span data-text="true">Insert Link</span><a target="_blank" title="Open Link" class="f-external-link" href="#"><i class="fa fa-external-link"></i></a><i title="Cancel" class="fa fa-times" id="f-link-close-' + this._id + '"></i></h4>', t += '<div class="f-popup-line fr-hidden"><input type="text" placeholder="Text" class="f-lt" id="f-lt-' + this._id + '"></div>';
    var e = "";
    if (this.options.linkList.length && (e = "f-bi"), t += '<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu ' + e + '" id="f-lu-' + this._id + '"/>', this.options.linkList.length) {
      t += '<button class="fr-p-bttn f-browse-links" id="f-browse-links-' + this._id + '"><i class="fa fa-chevron-down"></i></button>', t += '<ul id="f-link-list-' + this._id + '">';
      for (var i = 0; i < this.options.linkList.length; i++) {
        var n = this.options.linkList[i],
          s = "";
        for (var o in n) s += " data-" + o + '="' + n[o] + '"';
        t += '<li class="f-choose-link"' + s + ">" + n.body + "</li>"
      }
      t += "</ul>"
    }
    if (t += "</div>", Object.keys(this.options.linkClasses).length) {
      t += '<div class="f-popup-line"><input type="text" placeholder="Choose link type" class="f-bi" id="f-luc-' + this._id + '" disabled="disabled"/>', t += '<button class="fr-p-bttn f-browse-links" id="f-links-class-' + this._id + '"><i class="fa fa-chevron-down"></i></button>', t += '<ul id="f-link-class-list-' + this._id + '">';
      for (var r in this.options.linkClasses) {
        var a = this.options.linkClasses[r];
        t += '<li class="f-choose-link-class" data-class="' + r + '">' + a + "</li>"
      }
      t += "</ul>", t += "</div>"
    }
    for (var l in this.options.linkAttributes) {
      var h = this.options.linkAttributes[l];
      t += '<div class="f-popup-line"><input class="fl-' + l + '" type="text" placeholder="' + h + '" id="fl-' + l + "-" + this._id + '"/></div>'
    }
    return t += '<div class="f-popup-line"><input type="checkbox" class="f-target" id="f-target-' + this._id + '"> <label data-text="true" for="f-target-' + this._id + '">Open in new tab</label><button data-text="true" type="button" class="fr-p-bttn f-ok f-submit" id="f-ok-' + this._id + '">OK</button>', this.options.unlinkButton && (t += '<button type="button" data-text="true" class="fr-p-bttn f-ok f-unlink" id="f-unlink-' + this._id + '">UNLINK</button>'), t += "</div></div>"
  }, t.Editable.prototype.buildCreateLink = function() {
    this.$link_wrapper = t(this.createLinkHTML()), this.$popup_editor.append(this.$link_wrapper);
    var e = this;
    this.addListener("hidePopups", this.hideLinkWrapper), this.$link_wrapper.on("mouseup touchend", t.proxy(function(t) { this.isResizing() || (t.stopPropagation(), this.$link_wrapper.trigger("hideLinkList")) }, this)), this.$link_wrapper.on("click", function(t) { t.stopPropagation() }), this.$link_wrapper.on("click", "*", function(t) { t.stopPropagation() }), this.options.linkText && this.$link_wrapper.on("mouseup keydown", "input#f-lt-" + this._id, t.proxy(function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation(), this.$link_wrapper.trigger("hideLinkList"), this.$link_wrapper.trigger("hideLinkClassList")
    }, this)), this.$link_wrapper.on("mouseup keydown touchend touchstart", "input#f-lu-" + this._id, t.proxy(function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation(), this.$link_wrapper.trigger("hideLinkList"), this.$link_wrapper.trigger("hideLinkClassList")
    }, this)), this.$link_wrapper.on("click keydown", "input#f-target-" + this._id, function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation()
    }), this.$link_wrapper.on("touchend", "button#f-ok-" + this._id, function(t) { t.stopPropagation() }).on("click", "button#f-ok-" + this._id, t.proxy(function() {
      var t, e = this.$link_wrapper.find("input#f-lt-" + this._id),
        i = this.$link_wrapper.find("input#f-lu-" + this._id),
        n = this.$link_wrapper.find("input#f-luc-" + this._id),
        s = this.$link_wrapper.find("input#f-target-" + this._id);
      t = e ? e.val() : "";
      var o = i.val();
      this.isLink && "" === o && (o = "#");
      var r = "";
      n && (r = n.data("class"));
      var a = {};
      for (var l in this.options.linkAttributes) a[l] = this.$link_wrapper.find("input#fl-" + l + "-" + this._id).val();
      this.writeLink(o, t, r, s.prop("checked"), a)
    }, this)), this.$link_wrapper.on("click touch", "button#f-unlink-" + this._id, t.proxy(function() { this.link = !0, this.removeLink() }, this)), this.options.linkList.length && (this.$link_wrapper.on("click touch", "li.f-choose-link", function() {
      e.resetLinkValues();
      var i = e.$link_wrapper.find("button#f-browse-links-" + e._id),
        n = e.$link_wrapper.find("input#f-lt-" + e._id),
        s = e.$link_wrapper.find("input#f-lu-" + e._id),
        o = e.$link_wrapper.find("input#f-target-" + e._id);
      n && n.val(t(this).data("body")), s.val(t(this).data("href")), o.prop("checked", t(this).data("blank"));
      for (var r in e.options.linkAttributes) t(this).data(r) && e.$link_wrapper.find("input#fl-" + r + "-" + e._id).val(t(this).data(r));
      i.click()
    }).on("mouseup", "li.f-choose-link", function(t) { t.stopPropagation() }), this.$link_wrapper.on("click", "button#f-browse-links-" + this._id + ", button#f-browse-links-" + this._id + " > i", function(i) {
      i.stopPropagation();
      var n = e.$link_wrapper.find("ul#f-link-list-" + e._id);
      e.$link_wrapper.trigger("hideLinkClassList"), t(this).find("i").toggleClass("fa-chevron-down"), t(this).find("i").toggleClass("fa-chevron-up"), n.toggle()
    }).on("mouseup", "button#f-browse-links-" + this._id + ", button#f-browse-links-" + this._id + " > i", function(t) { t.stopPropagation() }), this.$link_wrapper.bind("hideLinkList", function() {
      var t = e.$link_wrapper.find("ul#f-link-list-" + e._id),
        i = e.$link_wrapper.find("button#f-browse-links-" + e._id);
      t && t.is(":visible") && i.click()
    })), Object.keys(this.options.linkClasses).length && (this.$link_wrapper.on("mouseup keydown", "input#f-luc-" + this._id, t.proxy(function(t) {
      var e = t.which;
      e && 27 === e || t.stopPropagation(), this.$link_wrapper.trigger("hideLinkList"), this.$link_wrapper.trigger("hideLinkClassList")
    }, this)), this.$link_wrapper.on("click touch", "li.f-choose-link-class", function() {
      var i = e.$link_wrapper.find("input#f-luc-" + e._id);
      i.val(t(this).text()), i.data("class", t(this).data("class")), e.$link_wrapper.trigger("hideLinkClassList")
    }).on("mouseup", "li.f-choose-link-class", function(t) { t.stopPropagation() }), this.$link_wrapper.on("click", "button#f-links-class-" + this._id, function(i) {
      i.stopPropagation(), e.$link_wrapper.trigger("hideLinkList");
      var n = e.$link_wrapper.find("ul#f-link-class-list-" + e._id);
      t(this).find("i").toggleClass("fa-chevron-down"), t(this).find("i").toggleClass("fa-chevron-up"), n.toggle()
    }).on("mouseup", "button#f-links-class-" + this._id, function(t) { t.stopPropagation() }), this.$link_wrapper.bind("hideLinkClassList", function() {
      var t = e.$link_wrapper.find("ul#f-link-class-list-" + e._id),
        i = e.$link_wrapper.find("button#f-links-class-" + e._id);
      t && t.is(":visible") && i.click()
    })), this.$link_wrapper.on(this.mouseup, "i#f-link-close-" + this._id, t.proxy(function() { this.$bttn_wrapper.show(), this.hideLinkWrapper(), (!this.options.inlineMode && !this.imageMode || this.isLink || 0 === this.options.buttons.length) && this.hide(), this.imageMode ? this.showImageEditor() : (this.restoreSelection(), this.focus()) }, this))
  }, t.Editable.prototype.getSelectionLinks = function() {
    var t, e, i, n, s = [];
    if (this.window.getSelection) {
      var o = this.window.getSelection();
      if (o.getRangeAt && o.rangeCount) {
        n = this.document.createRange();
        for (var r = 0; r < o.rangeCount; ++r)
          if (t = o.getRangeAt(r), e = t.commonAncestorContainer, e && 1 != e.nodeType && (e = e.parentNode), e && "a" == e.nodeName.toLowerCase()) s.push(e);
          else { i = e.getElementsByTagName("a"); for (var a = 0; a < i.length; ++a) n.selectNodeContents(i[a]), n.compareBoundaryPoints(t.END_TO_START, t) < 1 && n.compareBoundaryPoints(t.START_TO_END, t) > -1 && s.push(i[a]) }
      }
    } else if (this.document.selection && "Control" != this.document.selection.type)
      if (t = this.document.selection.createRange(), e = t.parentElement(), "a" == e.nodeName.toLowerCase()) s.push(e);
      else { i = e.getElementsByTagName("a"), n = this.document.body.createTextRange(); for (var l = 0; l < i.length; ++l) n.moveToElementText(i[l]), n.compareEndPoints("StartToEnd", t) > -1 && n.compareEndPoints("EndToStart", t) < 1 && s.push(i[l]) }
    return s
  }, t.Editable.prototype.resetLinkValues = function() { this.$link_wrapper.find("input").val(""), this.$link_wrapper.find('input[type="checkbox"].f-target').prop("checked", this.options.alwaysBlank), this.$link_wrapper.find('input[type="text"].f-lt').val(this.text()), this.$link_wrapper.find('input[type="text"].f-lu').val("http://"), this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"), this.$link_wrapper.find("a.f-external-link, button.f-unlink").hide(); for (var t in this.options.linkAttributes) this.$link_wrapper.find('input[type="text"].fl-' + t).val("") }, t.Editable.prototype.insertLink = function() {
    this.options.inlineMode || (this.closeImageMode(), this.imageMode = !1, this.positionPopup("createLink")), this.selectionInEditor() && this.saveSelection(), this.showInsertLink();
    var e = this.getSelectionLinks();
    e.length > 0 ? this.updateLinkValues(t(e[0])) : this.resetLinkValues()
  }
}(jQuery),
function(t) {
  t.Editable.prototype.browserFixes = function() { this.backspaceEmpty(), this.backspaceInEmptyBlock(), this.fixHR(), this.domInsert(), this.fixIME(), this.cleanInvisibleSpace(), this.cleanBR(), this.insertSpace() }, t.Editable.prototype.backspaceInEmptyBlock = function() {
    this.$element.on("keyup", t.proxy(function(e) {
      var i = e.which;
      if (this.browser.mozilla && !this.isHTML && 8 == i) {
        var n = t(this.getSelectionElement());
        this.valid_nodes.indexOf(n.get(0).tagName) >= 0 && 1 == n.find("*").length && "" === n.text() && 1 == n.find("br").length && this.setSelection(n.get(0))
      }
    }, this))
  }, t.Editable.prototype.insertSpace = function() {
    this.browser.mozilla && this.$element.on("keypress", t.proxy(function(t) {
      var e = t.which,
        i = this.getSelectionElements()[0];
      this.isHTML || 32 != e || "PRE" == i.tagName || (t.preventDefault(), this.insertSimpleHTML("&nbsp;"))
    }, this))
  }, t.Editable.prototype.cleanBR = function() {
    this.$element.on("keyup", t.proxy(function() {
      this.$element.find(this.valid_nodes.join(",")).each(t.proxy(function(e, i) {
        if (["TH", "TD", "LI"].indexOf(i.tagName) >= 0) return !0;
        var n = i.childNodes,
          s = null;
        if (!n.length || "BR" != n[n.length - 1].tagName) return !0;
        s = n[n.length - 1];
        var o = s.previousSibling;
        o && "BR" != o.tagName && t(s).parent().text().length > 0 && this.valid_nodes.indexOf(o.tagName) < 0 && t(s).remove()
      }, this))
    }, this))
  }, t.Editable.prototype.replaceU200B = function(e) { for (var i = 0; i < e.length; i++) 3 == e[i].nodeType && /\u200B/gi.test(e[i].textContent) ? e[i].textContent = e[i].textContent.replace(/\u200B/gi, "") : 1 == e[i].nodeType && this.replaceU200B(t(e[i]).contents()) }, t.Editable.prototype.cleanInvisibleSpace = function() {
    var e = function(e) { var i = t(e).text(); return e && /\u200B/.test(t(e).text()) && i.replace(/\u200B/gi, "").length > 0 ? !0 : !1 };
    this.$element.on("keyup", t.proxy(function() {
      var i = this.getSelectionElement();
      e(i) && 0 === t(i).find("li").length && (this.saveSelectionByMarkers(), this.replaceU200B(t(i).contents()), this.restoreSelectionByMarkers())
    }, this))
  }, t.Editable.prototype.fixHR = function() {
    this.$element.on("keypress", t.proxy(function(e) {
      var i = t(this.getSelectionElement());
      if (i.is("hr") || i.parents("hr").length) return !1;
      var n = e.which;
      if (8 == n) {
        var s = t(this.getSelectionElements()[0]);
        s.prev().is("hr") && this.getSelectionTextInfo(s.get(0)).atStart && (this.saveSelectionByMarkers(), s.prev().remove(), this.restoreSelectionByMarkers(), e.preventDefault())
      }
    }, this))
  }, t.Editable.prototype.backspaceEmpty = function() { this.$element.on("keydown", t.proxy(function(t) { var e = t.which;!this.isHTML && 8 == e && this.$element.hasClass("f-placeholder") && t.preventDefault() }, this)) }, t.Editable.prototype.domInsert = function() {
    this.$element.on("keydown", t.proxy(function(t) {
      var e = t.which;
      13 === e && (this.add_br = !0)
    }, this)), this.$element.on("DOMNodeInserted", t.proxy(function(e) {
      if ("SPAN" !== e.target.tagName || t(e.target).attr("data-fr-verified") || this.no_verify || this.textEmpty(e.target) || t(e.target).replaceWith(t(e.target).contents()), "BR" === e.target.tagName && setTimeout(function() { t(e.target).removeAttr("type") }, 0), "A" === e.target.tagName && setTimeout(function() { t(e.target).removeAttr("_moz_dirty") }, 0), this.options.paragraphy && this.add_br && "BR" === e.target.tagName && (t(e.target).prev().length && "TABLE" === t(e.target).prev().get(0).tagName || t(e.target).next().length && "TABLE" === t(e.target).next().get(0).tagName)) {
        t(e.target).wrap('<p class="fr-p-wrap">');
        var i = this.$element.find("p.fr-p-wrap").removeAttr("class");
        this.setSelection(i.get(0))
      }
      "BR" === e.target.tagName && this.isLastSibling(e.target) && "LI" == e.target.parentNode.tagName && this.textEmpty(e.target.parentNode) && t(e.target).remove()
    }, this)), this.$element.on("keyup", t.proxy(function(t) {
      var e = t.which;
      8 === e && this.$element.find("span:not([data-fr-verified])").attr("data-fr-verified", !0), 13 === e && (this.add_br = !1)
    }, this))
  }, t.Editable.prototype.fixIME = function() { try { this.$element.get(0).msGetInputContext && (this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowShow", t.proxy(function() { this.ime = !0 }, this)), this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowHide", t.proxy(function() { this.ime = !1, this.$element.trigger("keydown"), this.oldHTML = "" }, this))) } catch (e) {} }
}(jQuery),
function(t) {
  t.Editable.prototype.handleEnter = function() {
    var e = t.proxy(function() { var e = this.getSelectionElement(); return "LI" == e.tagName || this.parents(t(e), "li").length > 0 ? !0 : !1 }, this);
    this.$element.on("keypress", t.proxy(function(t) {
      if (!this.isHTML && !e()) {
        var i = t.which;
        if (13 == i && !t.shiftKey) {
          t.preventDefault(), this.saveUndoStep(), this.insertSimpleHTML("<break></break>");
          var n = this.getSelectionElements();
          if (n[0] == this.$element.get(0) ? this.enterInMainElement(n[0]) : this.enterInElement(n[0]), this.getSelectionTextInfo(this.$element.get(0)).atEnd) this.$wrapper.scrollTop(this.$element.height());
          else {
            var s = this.getBoundingRect();
            this.$wrapper.offset().top + this.$wrapper.height() < s.top + s.height && this.$wrapper.scrollTop(s.top + this.$wrapper.scrollTop() - (this.$wrapper.height() + this.$wrapper.offset().top) + s.height + 10)
          }
        }
      }
    }, this))
  }, t.Editable.prototype.enterInMainElement = function(e) {
    var i = t(e).find("break").get(0);
    if (t(i).parent().get(0) == e) this.isLastSibling(i) ? this.insertSimpleHTML("</br>" + this.markers_html + this.br) : t(e).hasClass("f-placeholder") ? t(e).html("</br>" + this.markers_html + this.br) : this.insertSimpleHTML("</br>" + this.markers_html), t(e).find("break").remove(), this.restoreSelectionByMarkers();
    else if (t(i).parents(this.$element).length) {
      for (e = this.getSelectionElement();
        "BREAK" == e.tagName || 0 === t(e).text().length && e.parentNode != this.$element.get(0);) e = e.parentNode;
      if (this.getSelectionTextInfo(e).atEnd) t(e).after(this.breakEnd(this.getDeepParent(e), !0)), this.$element.find("break").remove(), this.restoreSelectionByMarkers();
      else if (this.getSelectionTextInfo(e).atStart) {
        for (; i.parentNode != this.$element.get(0);) i = i.parentNode;
        t(i).before("<br/>"), this.$element.find("break").remove(), this.$element.find("a:empty").replaceWith(this.markers_html + "<br/>"), this.restoreSelectionByMarkers()
      } else this.breakMiddle(this.getDeepParent(e), !0), this.restoreSelectionByMarkers()
    } else t(i).remove()
  }, t.Editable.prototype.enterInElement = function(e) {
    if (["TD", "TH"].indexOf(e.tagName) < 0) {
      var i = !1;
      if (this.emptyElement(e) && e.parentNode && "BLOCKQUOTE" == e.parentNode.tagName) {
        t(e).before(this.$element.find("break"));
        var n = e;
        e = e.parentNode, t(n).remove(), i = !0
      }
      this.getSelectionTextInfo(e).atEnd ? (t(e).after(this.breakEnd(e), !1), this.$element.find("break").remove(), this.restoreSelectionByMarkers()) : this.getSelectionTextInfo(e).atStart ? (this.options.paragraphy ? i ? (t(e).before("<" + this.options.defaultTag + ">" + this.markers_html + this.br + "</" + this.options.defaultTag + ">"), this.restoreSelectionByMarkers()) : t(e).before("<" + this.options.defaultTag + ">" + this.br + "</" + this.options.defaultTag + ">") : i ? (t(e).before(this.markers_html + "<br/>"), this.restoreSelectionByMarkers()) : t(e).before("<br/>"), this.$element.find("break").remove()) : "PRE" == e.tagName ? (this.$element.find("break").after("<br/>" + this.markers_html), this.$element.find("break").remove(), this.restoreSelectionByMarkers()) : (this.breakMiddle(e, !1, i), this.restoreSelectionByMarkers())
    } else this.enterInMainElement(e)
  }, t.Editable.prototype.breakEnd = function(e, i) {
    if (void 0 === i && (i = !1), "BLOCKQUOTE" == e.tagName) {
      var n = t(e).contents();
      n.length && "BR" == n[n.length - 1].tagName && t(n[n.length - 1]).remove()
    }
    var s = t(e).find("break").get(0),
      o = this.br;
    this.options.paragraphy || (o = "<br/>");
    var r = this.markers_html + o;
    for (i && (r = this.markers_html + t.Editable.INVISIBLE_SPACE); s != e;) "A" != s.tagName && "BREAK" != s.tagName && (r = "<" + s.tagName + this.attrs(s) + ">" + r + "</" + s.tagName + ">"), s = s.parentNode;
    return i && "A" != s.tagName && "BREAK" != s.tagName && (r = "<" + s.tagName + this.attrs(s) + ">" + r + "</" + s.tagName + ">"), this.options.paragraphy && (r = "<" + this.options.defaultTag + ">" + r + "</" + this.options.defaultTag + ">"), i && (r = o + r), r
  }, t.Editable.prototype.breakMiddle = function(e, i, n) {
    void 0 === i && (i = !1), void 0 === n && (n = !1);
    var s = t(e).find("break").get(0),
      o = this.markers_html;
    n && (o = "");
    for (var r = ""; s != e;) s = s.parentNode, r = r + "</" + s.tagName + ">", o = "<" + s.tagName + this.attrs(s) + ">" + o;
    var a = "";
    n && (a = this.options.paragraphy ? "<" + this.options.defaultTag + ">" + this.markers_html + "<br/></" + this.options.defaultTag + ">" : this.markers_html + "<br/>");
    var l = "<" + e.tagName + this.attrs(e) + ">" + t(e).html() + "</" + e.tagName + ">";
    l = l.replace(/<break><\/break>/, r + (i ? this.br : "") + a + o), t(e).replaceWith(l)
  }
}(jQuery),
function(t) {
  t.Editable.prototype.isFirstSibling = function(t) { var e = t.previousSibling; return e ? 3 == e.nodeType && "" === e.textContent ? this.isFirstSibling(e) : !1 : !0 }, t.Editable.prototype.isLastSibling = function(t) { var e = t.nextSibling; return e ? 3 == e.nodeType && "" === e.textContent ? this.isLastSibling(e) : !1 : !0 }, t.Editable.prototype.getDeepParent = function(t) { return t.parentNode == this.$element.get(0) ? t : this.getDeepParent(t.parentNode) }, t.Editable.prototype.attrs = function(t) {
    for (var e = "", i = t.attributes, n = 0; n < i.length; n++) {
      var s = i[n];
      e += " " + s.nodeName + '="' + s.value + '"'
    }
    return e
  }
}(jQuery),
function(t) { "function" == typeof define && define.amd ? define(["jquery"], t) : t(jQuery) }(function(t, e) {
  function i(t) {
    function e() { n ? (i(), j(e), s = !0, n = !1) : s = !1 }
    var i = t,
      n = !1,
      s = !1;
    this.kick = function() { n = !0, s || e() }, this.end = function(t) {
      var e = i;
      t && (s ? (i = n ? function() { e(), t() } : t, n = !0) : t())
    }
  }

  function n() { return !0 }

  function s() { return !1 }

  function o(t) { t.preventDefault() }

  function r(t) { R[t.target.tagName.toLowerCase()] || t.preventDefault() }

  function a(t) { return 1 === t.which && !t.ctrlKey && !t.altKey }

  function l(t, e) {
    var i, n;
    if (t.identifiedTouch) return t.identifiedTouch(e);
    for (i = -1, n = t.length; ++i < n;)
      if (t[i].identifier === e) return t[i]
  }

  function h(t, e) { var i = l(t.changedTouches, e.identifier); return !i || i.pageX === e.pageX && i.pageY === e.pageY ? void 0 : i }

  function c(t) {
    var e;
    a(t) && (e = { target: t.target, startX: t.pageX, startY: t.pageY, timeStamp: t.timeStamp }, A(document, F.move, d, e), A(document, F.cancel, u, e))
  }

  function d(t) {
    var e = t.data;
    y(t, e, t, p)
  }

  function u() { p() }

  function p() { N(document, F.move, d), N(document, F.cancel, u) }

  function f(t) {
    var e, i;
    R[t.target.tagName.toLowerCase()] || (e = t.changedTouches[0], i = { target: e.target, startX: e.pageX, startY: e.pageY, timeStamp: t.timeStamp, identifier: e.identifier }, A(document, H.move + "." + e.identifier, m, i), A(document, H.cancel + "." + e.identifier, g, i))
  }

  function m(t) {
    var e = t.data,
      i = h(t, e);
    i && y(t, e, i, v)
  }

  function g(t) {
    var e = t.data,
      i = l(t.changedTouches, e.identifier);
    i && v(e.identifier)
  }

  function v(t) { N(document, "." + t, m), N(document, "." + t, g) }

  function y(t, e, i, n) {
    var s = i.pageX - e.startX,
      o = i.pageY - e.startY;
    L * L > s * s + o * o || _(t, e, i, s, o, n)
  }

  function b() { return this._handled = n, !1 }

  function w(t) { try { t._handled() } catch (e) { return !1 } }

  function _(t, e, i, n, s, o) {
    var r, a;
    e.target, r = t.targetTouches, a = t.timeStamp - e.timeStamp, e.type = "movestart", e.distX = n, e.distY = s, e.deltaX = n, e.deltaY = s, e.pageX = i.pageX, e.pageY = i.pageY, e.velocityX = n / a, e.velocityY = s / a, e.targetTouches = r, e.finger = r ? r.length : 1, e._handled = b, e._preventTouchmoveDefault = function() { t.preventDefault() }, O(e.target, e), o(e.identifier)
  }

  function x(t) {
    var e = t.data.timer;
    t.data.touch = t, t.data.timeStamp = t.timeStamp, e.kick()
  }

  function k(t) {
    var e = t.data.event,
      i = t.data.timer;
    C(), $(e, i, function() { setTimeout(function() { N(e.target, "click", s) }, 0) })
  }

  function C() { N(document, F.move, x), N(document, F.end, k) }

  function S(t) {
    var e = t.data.event,
      i = t.data.timer,
      n = h(t, e);
    n && (t.preventDefault(), e.targetTouches = t.targetTouches, t.data.touch = n, t.data.timeStamp = t.timeStamp, i.kick())
  }

  function T(t) {
    var e = t.data.event,
      i = t.data.timer,
      n = l(t.changedTouches, e.identifier);
    n && (E(e), $(e, i))
  }

  function E(t) { N(document, "." + t.identifier, S), N(document, "." + t.identifier, T) }

  function I(t, e, i) {
    var n = i - t.timeStamp;
    t.type = "move", t.distX = e.pageX - t.startX, t.distY = e.pageY - t.startY, t.deltaX = e.pageX - t.pageX, t.deltaY = e.pageY - t.pageY, t.velocityX = .3 * t.velocityX + .7 * t.deltaX / n, t.velocityY = .3 * t.velocityY + .7 * t.deltaY / n, t.pageX = e.pageX, t.pageY = e.pageY
  }

  function $(t, e, i) { e.end(function() { return t.type = "moveend", O(t.target, t), i && i() }) }

  function D() { return A(this, "movestart.move", w), !0 }

  function P() { return N(this, "dragstart drag", o), N(this, "mousedown touchstart", r), N(this, "movestart", w), !0 }

  function M(t) { "move" !== t.namespace && "moveend" !== t.namespace && (A(this, "dragstart." + t.guid + " drag." + t.guid, o, e, t.selector), A(this, "mousedown." + t.guid, r, e, t.selector)) }

  function z(t) { "move" !== t.namespace && "moveend" !== t.namespace && (N(this, "dragstart." + t.guid + " drag." + t.guid), N(this, "mousedown." + t.guid)) }
  var L = 6,
    A = t.event.add,
    N = t.event.remove,
    O = function(e, i, n) { t.event.trigger(i, n, e) },
    j = function() { return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(t) { return window.setTimeout(function() { t() }, 25) } }(),
    R = { textarea: !0, input: !0, select: !0, button: !0 },
    F = { move: "mousemove", cancel: "mouseup dragstart", end: "mouseup" },
    H = { move: "touchmove", cancel: "touchend", end: "touchend" };
  t.event.special.movestart = {
    setup: D,
    teardown: P,
    add: M,
    remove: z,
    _default: function(t) {
      function n() { I(o, r.touch, r.timeStamp), O(t.target, o) }
      var o, r;
      t._handled() && (o = { target: t.target, startX: t.startX, startY: t.startY, pageX: t.pageX, pageY: t.pageY, distX: t.distX, distY: t.distY, deltaX: t.deltaX, deltaY: t.deltaY, velocityX: t.velocityX, velocityY: t.velocityY, timeStamp: t.timeStamp, identifier: t.identifier, targetTouches: t.targetTouches, finger: t.finger }, r = { event: o, timer: new i(n), touch: e, timeStamp: e }, t.identifier === e ? (A(t.target, "click", s), A(document, F.move, x, r), A(document, F.end, k, r)) : (t._preventTouchmoveDefault(), A(document, H.move + "." + t.identifier, S, r), A(document, H.end + "." + t.identifier, T, r)))
    }
  }, t.event.special.move = { setup: function() { A(this, "movestart.move", t.noop) }, teardown: function() { N(this, "movestart.move", t.noop) } }, t.event.special.moveend = { setup: function() { A(this, "movestart.moveend", t.noop) }, teardown: function() { N(this, "movestart.moveend", t.noop) } }, A(document, "mousedown.move", c), A(document, "touchstart.move", f), "function" == typeof Array.prototype.indexOf && ! function(t) { for (var e = ["changedTouches", "targetTouches"], i = e.length; i--;) - 1 === t.event.props.indexOf(e[i]) && t.event.props.push(e[i]) }(t)
}), window.WYSIWYGModernizr = function(t, e, i) {
    function n(t) { p.cssText = t }

    function s(t, e) { return typeof t === e }
    var o, r, a, l = "2.7.1",
      h = {},
      c = e.documentElement,
      d = "modernizr",
      u = e.createElement(d),
      p = u.style,
      f = ({}.toString, " -webkit- -moz- -o- -ms- ".split(" ")),
      m = {},
      g = [],
      v = g.slice,
      y = function(t, i, n, s) {
        var o, r, a, l, h = e.createElement("div"),
          u = e.body,
          p = u || e.createElement("body");
        if (parseInt(n, 10))
          for (; n--;) a = e.createElement("div"), a.id = s ? s[n] : d + (n + 1), h.appendChild(a);
        return o = ["&#173;", '<style id="s', d, '">', t, "</style>"].join(""), h.id = d, (u ? h : p).innerHTML += o, p.appendChild(h), u || (p.style.background = "", p.style.overflow = "hidden", l = c.style.overflow, c.style.overflow = "hidden", c.appendChild(p)), r = i(h, t), u ? h.parentNode.removeChild(h) : (p.parentNode.removeChild(p), c.style.overflow = l), !!r
      },
      b = function(e) { var i = t.matchMedia || t.msMatchMedia; if (i) return i(e).matches; var n; return y("@media " + e + " { #" + d + " { position: absolute; } }", function(e) { n = "absolute" == (t.getComputedStyle ? getComputedStyle(e, null) : e.currentStyle).position }), n },
      w = {}.hasOwnProperty;
    a = s(w, "undefined") || s(w.call, "undefined") ? function(t, e) { return e in t && s(t.constructor.prototype[e], "undefined") } : function(t, e) { return w.call(t, e) }, Function.prototype.bind || (Function.prototype.bind = function(t) {
      var e = this;
      if ("function" != typeof e) throw new TypeError;
      var i = v.call(arguments, 1),
        n = function() {
          if (this instanceof n) {
            var s = function() {};
            s.prototype = e.prototype;
            var o = new s,
              r = e.apply(o, i.concat(v.call(arguments)));
            return Object(r) === r ? r : o
          }
          return e.apply(t, i.concat(v.call(arguments)))
        };
      return n
    }), m.touch = function() { var i; return "ontouchstart" in t || t.DocumentTouch && e instanceof DocumentTouch ? i = !0 : y(["@media (", f.join("touch-enabled),("), d, ")", "{#modernizr{top:9px;position:absolute}}"].join(""), function(t) { i = 9 === t.offsetTop }), i };
    for (var _ in m) a(m, _) && (r = _.toLowerCase(), h[r] = m[_](), g.push((h[r] ? "" : "no-") + r));
    return h.addTest = function(t, e) {
      if ("object" == typeof t)
        for (var n in t) a(t, n) && h.addTest(n, t[n]);
      else {
        if (t = t.toLowerCase(), h[t] !== i) return h;
        e = "function" == typeof e ? e() : e, "undefined" != typeof enableClasses && enableClasses && (c.className += " " + (e ? "" : "no-") + t), h[t] = e
      }
      return h
    }, n(""), u = o = null, h._version = l, h._prefixes = f, h.mq = b, h.testStyles = y, h
  }(this, document), ! function(t) {
    t.Editable.prototype.coreInit = function() {
      var t = this,
        e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        i = function(t) { for (var e = t.toString(), i = 0, n = 0; n < e.length; n++) i += parseInt(e.charAt(n), 10); return i > 10 ? i % 9 + 1 : i };
      if (t.options.key !== !1) {
        var n = function(t, e, i) { for (var n = Math.abs(i); n-- > 0;) t -= e; return 0 > i && (t += 123), t },
          s = function(t) { return t },
          o = function(t) {
            if (!t) return t;
            for (var o = "", r = s("charCodeAt"), a = s("fromCharCode"), l = e.indexOf(t[0]), h = 1; h < t.length - 2; h++) {
              for (var c = i(++l), d = t[r](h), u = "";
                /[0-9-]/.test(t[h + 1]);) u += t[++h];
              u = parseInt(u, 10) || 0, d = n(d, c, u), d ^= l - 1 & 31, o += String[a](d)
            }
            return o
          },
          r = s(o),
          a = function(t) { return "none" == t.css("display") ? (t.attr("style", t.attr("style") + r("zD4D2qJ-7dhuB-11bB4E1wqlhlfE4gjhkbB6C5eg1C-8h1besB-16e1==")), !0) : !1 },
          l = function() { for (var t = 0, e = document.domain, i = e.split("."), n = "_gd" + (new Date).getTime(); t < i.length - 1 && -1 == document.cookie.indexOf(n + "=" + n);) e = i.slice(-1 - ++t).join("."), document.cookie = n + "=" + n + ";domain=" + e + ";"; return document.cookie = n + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=" + e + ";", e }(),
          h = function() { var e = r(t.options.key) || ""; return e !== r("eQZMe1NJGC1HTMVANU==") && e.indexOf(l, e.length - l.length) < 0 && [r("9qqG-7amjlwq=="), r("KA3B3C2A6D1D5H5H1A3==")].indexOf(l) < 0 ? (t.$box.append(r("uA5kygD3g1h1lzrA7E2jtotjvooB2A5eguhdC-22C-16nC2B3lh1deA-21C-16B4A2B4gi1F4D1wyA-13jA4H5C2rA-65A1C10dhzmoyJ2A10A-21d1B-13xvC2I4enC4C2B5B4G4G4H1H4A10aA8jqacD1C3c1B-16D-13A-13B2E5A4jtxfB-13fA1pewxvzA3E-11qrB4E4qwB-16icA1B3ykohde1hF4A2E4clA4C7E6haA4D1xtmolf1F-10A1H4lhkagoD5naalB-22B8B4quvB-8pjvouxB3A-9plnpA2B6D6BD2D1C2H1C3C3A4mf1G-10C-8i1G3C5B3pqB-9E5B1oyejA3ddalvdrnggE3C3bbj1jC6B3D3gugqrlD8B2DB-9qC-7qkA10D2VjiodmgynhA4HA-9D-8pI-7rD4PrE-11lvhE3B5A-16C7A6A3ekuD1==")), t.$lb = t.$box.find("> div:last"), t.$ab = t.$lb.find("> a"), a(t.$lb) || a(t.$ab)) : void 0 };
        h()
      }
    }, t.Editable.initializers.push(t.Editable.prototype.coreInit)
  }(jQuery),
  function(t) {
    t.Editable.DEFAULTS = t.extend(t.Editable.DEFAULTS, { allowedBlankTags: ["TEXTAREA"], selfClosingTags: ["br", "input", "img", "hr", "param", "!--", "source", "embed", "!", "meta", "link", "base"], doNotJoinTags: ["a"], iconClasses: ["fa-"] }), t.Editable.prototype.isClosingTag = function(t) {
      return t ? null !== t.match(/^<\/([a-zA-Z0-9]+)([^<]+)*>$/gi) : !1
    }, t.Editable.prototype.tagName = function(t) { return t.replace(/^<\/?([a-zA-Z0-9-!]+)([^>]+)*>$/gi, "$1").toLowerCase() }, t.Editable.SELF_CLOSING_AFTER = ["source"], t.Editable.prototype.isSelfClosingTag = function(t) { var e = this.tagName(t); return this.options.selfClosingTags.indexOf(e.toLowerCase()) >= 0 }, t.Editable.prototype.tagKey = function(t) { return t.type + (t.attrs || []).sort().join("|") }, t.Editable.prototype.extendedKey = function(t) { return this.tagKey(t) + JSON.stringify(t.style) }, t.Editable.prototype.mapDOM = function(e) {
      var i = [],
        n = {},
        s = {},
        o = 0,
        r = this;
      t(e).find(".f-marker").html(t.Editable.INVISIBLE_SPACE);
      var a = function(e, i) {
          if (3 === e.nodeType) return [];
          if (8 === e.nodeType) return [{ comment: !0, attrs: {}, styles: {}, idx: o++, sp: i, ep: i, text: e.textContent }];
          var n = e.tagName;
          "B" == n && (n = "STRONG"), "I" != n || e.className && null != e.className.match(new RegExp(r.options.iconClasses.join("|"), "gi")) || (n = "EM");
          var s = {},
            a = {},
            l = null;
          if (e.attributes)
            for (var h = 0; h < e.attributes.length; h++) { var c = e.attributes[h]; "style" == c.nodeName ? l = c.value : s[c.nodeName] = c.value }
          if (l) {
            var d = l.match(/([^:]*):([^:;]*(;|$))/gi);
            if (d)
              for (var u = 0; u < d.length; u++) {
                var p = d[u].split(":"),
                  f = p.slice(1).join(":").trim();
                ";" == f[f.length - 1] && (f = f.substr(0, f.length - 1)), a[p[0].trim()] = f
              }
          }
          var m = [];
          if (t.isEmptyObject(s) && "SPAN" == e.tagName && !t.isEmptyObject(a)) {
            for (var g in a) {
              var v = {};
              v[g] = a[g], m.push({ selfClosing: !1, attrs: s, styles: v, idx: o++, sp: i, ep: i + e.textContent.length, tagName: n, noJoin: e.nextSibling && "BR" === e.nextSibling.tagName })
            }
            return m
          }
          return [{ selfClosing: r.options.selfClosingTags.indexOf(n.toLowerCase()) >= 0, attrs: s, styles: a, idx: o++, sp: i, ep: i + e.textContent.length, tagName: n, noJoin: e.nextSibling && "BR" === e.nextSibling.tagName }]
        },
        l = function(t, r) {
          var h, c, d;
          if (t != e)
            for (c = a(t, r), h = 0; h < c.length; h++) d = c[h], i.push(d), n[d.sp] || (n[d.sp] = {}), s[d.ep] || (s[d.ep] = {}), n[d.sp][d.tagName] || (n[d.sp][d.tagName] = []), s[d.ep][d.tagName] || (s[d.ep][d.tagName] = []), n[d.sp][d.tagName].push(d), s[d.ep][d.tagName].push(d);
          var u = t.childNodes;
          if (u) {
            for (h = 0; h < u.length; h++) h > 0 && 8 != u[h - 1].nodeType && (r += u[h - 1].textContent.length), l(u[h], r);
            if (c)
              for (h = 0; h < c.length; h++) d = c[h], d.ci = o++, n[d.ep] || (n[d.ep] = {}), n[d.ep][d.tagName] || (n[d.ep][d.tagName] = []), n[d.ep][d.tagName].push({ shadow: !0, ci: o - 1 })
          }
        },
        h = function() {
          var e, s, o, a;
          for (e in n)
            for (var l in n[e])
              for (o = 0; o < n[e][l].length; o++)
                if (s = n[e][l][o], !s.selfClosing && !(s.dirty || s.shadow || s.comment || s.noJoin))
                  for (var h = o + 1; h < n[e][l].length; h++)
                    if (a = n[e][l][h], !a.selfClosing && !(a.dirty || a.shadow || a.comment || a.noJoin || 1 != Object.keys(s.styles).length || 1 != Object.keys(a.styles).length || a.sp == a.ep)) { var c = Object.keys(s.styles)[0]; if (a.styles[c]) { s.sp = a.ep; for (var d = 0; d < n[s.sp][s.tagName].length; d++) { var u = n[s.sp][s.tagName][d]; if (u.shadow && u.ci == a.ci) { n[s.sp][s.tagName].splice(d, 0, s); break } } n[e][l].splice(o, 1), o--; break } }
          for (e = 0; e < i.length; e++)
            if (s = i[e], !(s.dirty || s.selfClosing || s.comment || s.noJoin || s.shadow || r.options.doNotJoinTags.indexOf(s.tagName.toLowerCase()) >= 0 || !t.isEmptyObject(s.attrs)))
              if (s.sp == s.ep && t.isEmptyObject(s.attrs) && t.isEmptyObject(s.styles) && r.options.allowedBlankTags.indexOf(s.tagName) < 0) s.dirty = !0;
              else if (n[s.ep] && n[s.ep][s.tagName])
            for (o = 0; o < n[s.ep][s.tagName].length; o++)
              if (a = n[s.ep][s.tagName][o], s != a && !(a.dirty || a.selfClosing || a.shadow || a.comment || a.noJoin || !t.isEmptyObject(a.attrs) || JSON.stringify(a.styles) != JSON.stringify(s.styles))) { s.ep < a.ep && (s.ep = a.ep), s.sp > a.sp && (s.sp = a.sp), a.dirty = !0, e--; break }
          for (e = 0; e < i.length; e++)
            if (s = i[e], !(s.dirty || s.selfClosing || s.comment || s.noJoin || s.shadow || !t.isEmptyObject(s.attrs)))
              if (s.sp == s.ep && t.isEmptyObject(s.attrs) && t.isEmptyObject(s.style) && r.options.allowedBlankTags.indexOf(s.tagName) < 0) s.dirty = !0;
              else if (n[s.sp] && n[s.sp][s.tagName])
            for (o = n[s.sp][s.tagName].length - 1; o >= 0; o--) a = n[s.sp][s.tagName][o], s != a && (a.dirty || a.selfClosing || a.shadow || a.comment || a.noJoin || s.ep == a.ep && t.isEmptyObject(a.attrs) && (s.styles = t.extend(s.styles, a.styles), a.dirty = !0))
        };
      l(e, 0), h();
      for (var c = i.length - 1; c >= 0; c--) i.dirty && i.splice(c, 1);
      return i
    }, t.Editable.prototype.sortNodes = function(t, e) {
      if (t.comment) return 1;
      if (t.selfClosing || e.selfClosing) return t.idx - e.idx;
      var i = t.ep - t.sp,
        n = e.ep - e.sp;
      return 0 === i && 0 === n ? t.idx - e.idx : i === n ? e.ci - t.ci : n - i
    }, t.Editable.prototype.openTag = function(t) {
      var e, i = "<" + t.tagName.toLowerCase(),
        n = Object.keys(t.attrs).sort();
      for (e = 0; e < n.length; e++) {
        var s = n[e];
        i += " " + s + '="' + t.attrs[s] + '"'
      }
      var o = "",
        r = Object.keys(t.styles).sort();
      for (e = 0; e < r.length; e++) {
        var a = r[e];
        null != t.styles[a] && (o += a.replace("_", "-") + ": " + t.styles[a] + "; ")
      }
      return "" !== o && (i += ' style="' + o.trim() + '"'), i += ">"
    }, t.Editable.prototype.commentTag = function(t) {
      var e = "";
      if (t.selfClosing) {
        var i;
        e = "<" + t.tagName.toLowerCase();
        var n = Object.keys(t.attrs).sort();
        for (i = 0; i < n.length; i++) {
          var s = n[i];
          e += " " + s + '="' + t.attrs[s] + '"'
        }
        var o = "",
          r = Object.keys(t.styles).sort();
        for (i = 0; i < r.length; i++) {
          var a = r[i];
          null != t.styles[a] && (o += a.replace("_", "-") + ": " + t.styles[a] + "; ")
        }
        "" !== o && (e += ' style="' + o.trim() + '"'), e += "/>"
      } else t.comment && (e = "<!--" + t.text + "-->");
      return e
    }, t.Editable.prototype.closeTag = function(t) { return "</" + t.tagName.toLowerCase() + ">" }, t.Editable.prototype.nodesOpenedAt = function(t, e) { for (var i = [], n = t.length - 1; n >= 0 && t[n].sp == e;) i.push(t.pop()), n--; return i }, t.Editable.prototype.entity = function(t) { return ch_map = { ">": "&gt;", "<": "&lt;", "&": "&amp;" }, ch_map[t] ? ch_map[t] : t }, t.Editable.prototype.removeInvisibleWhitespace = function(t) {
      for (var e = 0; e < t.childNodes.length; e++) {
        var i = t.childNodes[e];
        i.childNodes.length ? this.removeInvisibleWhitespace(i) : i.textContent = i.textContent.replace(/\u200B/gi, "")
      }
    }, t.Editable.prototype.cleanOutput = function(e, i) {
      var n, s, o, r;
      i && this.removeInvisibleWhitespace(e);
      var a = this.mapDOM(e, i).sort(function(t, e) { return e.sp - t.sp }),
        l = e.textContent;
      html = "";
      var h = [],
        c = -1,
        d = t.proxy(function() {
          var e = "";
          for (simple_nodes_to_close = [], h = h.sort(function(t, e) { return t.idx - e.idx }).reverse(); h.length;) {
            for (var i = h.pop(); simple_nodes_to_close.length && simple_nodes_to_close[simple_nodes_to_close.length - 1].ci < i.ci;) e += this.closeTag(simple_nodes_to_close.pop());
            i.selfClosing || i.comment ? e += this.commentTag(i) : (!t.isEmptyObject(i.attrs) || this.options.allowedBlankTags.indexOf(i.tagName) >= 0) && (e += this.openTag(i), simple_nodes_to_close.push(i))
          }
          for (; simple_nodes_to_close.length;) e += this.closeTag(simple_nodes_to_close.pop());
          html += e
        }, this),
        u = {},
        p = [];
      for (n = 0; n <= l.length; n++) {
        if (u[n])
          for (s = u[n].length - 1; s >= 0; s--)
            if (p.length && p[p.length - 1].tagName == u[n][s].tagName && JSON.stringify(p[p.length - 1].styles) == JSON.stringify(u[n][s].styles)) html += this.closeTag(u[n][s]), p.pop();
            else {
              for (var f = []; p.length && (p[p.length - 1].tagName !== u[n][s].tagName || JSON.stringify(p[p.length - 1].styles) !== JSON.stringify(u[n][s].styles));) r = p.pop(), html += this.closeTag(r), f.push(r);
              for (html += this.closeTag(u[n][s]), p.pop(); f.length;) {
                var m = f.pop();
                html += this.openTag(m), p.push(m)
              }
            }
        for (var g = this.nodesOpenedAt(a, n).sort(this.sortNodes).reverse(); g.length;) {
          var v = g.pop();
          if (!v.dirty)
            if (v.selfClosing || v.comment) v.ci > c || "BR" == v.tagName ? (d(), html += this.commentTag(v), c = v.ci) : h.length ? (h.push(v), c < v.ci && (c = v.ci)) : (html += this.commentTag(v), c < v.ci && (c = v.ci));
            else if (v.ep > v.sp) {
            v.ci > c && d();
            var y = [];
            if ("A" == v.tagName)
              for (var b = v.sp + 1; b < v.ep; b++)
                if (u[b] && u[b].length)
                  for (o = 0; o < u[b].length; o++) y.push(u[b][o]), html += this.closeTag(u[b][o]), p.pop();
            var w = [];
            if ("SPAN" == v.tagName && ("#123456" == v.styles["background-color"] || "#123456" === t.Editable.RGBToHex(v.styles["background-color"]) || "#123456" == v.styles.color || "#123456" === t.Editable.RGBToHex(v.styles.color)))
              for (; p.length;) {
                var _ = p.pop();
                html += this.closeTag(_), w.push(_)
              }
            for (html += this.openTag(v), c < v.ci && (c = v.ci), p.push(v), u[v.ep] || (u[v.ep] = []), u[v.ep].push(v); y.length;) v = y.pop(), html += this.openTag(v), p.push(v);
            for (; w.length;) v = w.pop(), html += this.openTag(v), p.push(v)
          } else v.sp == v.ep && (h.push(v), c < v.ci && (c = v.ci))
        }
        d(), n != l.length && (html += this.entity(l[n]))
      }
      return html = html.replace(/(<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>)\u200B(<\/span>)/gi, "$1$2")
    }, t.Editable.prototype.wrapDirectContent = function() {
      var e = t.merge(["UL", "OL", "TABLE"], this.valid_nodes);
      if (!this.options.paragraphy)
        for (var i = null, n = this.$element.contents(), s = 0; s < n.length; s++) 1 != n[s].nodeType || e.indexOf(n[s].tagName) < 0 ? (i || (i = t('<div class="fr-wrap">'), t(n[s]).before(i)), i.append(n[s])) : i = null
    }, t.Editable.prototype.cleanify = function(e, i, n) {
      if (this.browser.msie && t.Editable.getIEversion() < 9) return !1;
      var s;
      if (this.isHTML) return !1;
      void 0 === e && (e = !0), void 0 === n && (n = !0), this.no_verify = !0, this.$element.find("span").removeAttr("data-fr-verified"), n && this.saveSelectionByMarkers(), e ? s = this.getSelectionElements() : (this.wrapDirectContent(), s = this.$element.find(this.valid_nodes.join(",")), 0 === s.length && (s = [this.$element.get(0)]));
      var o, r;
      if (s[0] != this.$element.get(0))
        for (var a = 0; a < s.length; a++) {
          var l = t(s[a]);
          0 === l.find(this.valid_nodes.join(",")).length && (o = l.html(), r = this.cleanOutput(l.get(0), i), r !== o && l.html(r))
        } else 0 === this.$element.find(this.valid_nodes.join(",")).length && (o = this.$element.html(), r = this.cleanOutput(this.$element.get(0), i), r !== o && this.$element.html(r));
      this.$element.find("[data-fr-idx]").removeAttr("data-fr-idx"), this.$element.find(".fr-wrap").each(function() { t(this).replaceWith(t(this).html()) }), this.$element.find(".f-marker").html(""), n && this.restoreSelectionByMarkers(), this.$element.find("span").attr("data-fr-verified", !0), this.no_verify = !1
    }
  }(jQuery),
  function(t) {
    function e(t, e) {
      if (!(t.originalEvent.touches.length > 1)) {
        t.preventDefault();
        var i = t.originalEvent.changedTouches[0],
          n = document.createEvent("MouseEvents");
        n.initMouseEvent(e, !0, !0, window, 1, i.screenX, i.screenY, i.clientX, i.clientY, !1, !1, !1, !1, 0, null), t.target.dispatchEvent(n)
      }
    }
    if (t.support.touch = "ontouchend" in document, t.support.touch) {
      var i, n = t.ui.mouse.prototype,
        s = n._mouseInit,
        o = n._mouseDestroy;
      n._touchStart = function(t) { var n = this;!i && n._mouseCapture(t.originalEvent.changedTouches[0]) && (i = !0, n._touchMoved = !1, e(t, "mouseover"), e(t, "mousemove"), e(t, "mousedown")) }, n._touchMove = function(t) { i && (this._touchMoved = !0, e(t, "mousemove")) }, n._touchEnd = function(t) { i && (e(t, "mouseup"), e(t, "mouseout"), this._touchMoved || e(t, "click"), i = !1) }, n._mouseInit = function() {
        var e = this;
        e.element.bind({ touchstart: t.proxy(e, "_touchStart"), touchmove: t.proxy(e, "_touchMove"), touchend: t.proxy(e, "_touchEnd") }), s.call(e)
      }, n._mouseDestroy = function() {
        var e = this;
        e.element.unbind({ touchstart: t.proxy(e, "_touchStart"), touchmove: t.proxy(e, "_touchMove"), touchend: t.proxy(e, "_touchEnd") }), o.call(e)
      }
    }
  }(jQuery),
  function() {
    ! function(t, e) {
      var i, n, s;
      return s = "shapeshift", n = { selector: "*", enableDrag: !0, enableCrossDrop: !0, enableResize: !0, enableTrash: !1, align: "center", colWidth: null, columns: null, minColumns: 1, autoHeight: !0, maxHeight: null, minHeight: 100, gutterX: 10, gutterY: 10, paddingX: 10, paddingY: 10, animated: !0, animateOnInit: !1, animationSpeed: 225, animationThreshold: 100, dragClone: !1, deleteClone: !0, dragRate: 100, dragWhitelist: "*", crossDropWhitelist: "*", cutoffStart: null, cutoffEnd: null, handle: !1, cloneClass: "ss-cloned-child", activeClass: "ss-active-child", draggedClass: "ss-dragged-child", placeholderClass: "ss-placeholder-child", originalContainerClass: "ss-original-container", currentContainerClass: "ss-current-container", previousContainerClass: "ss-previous-container" }, i = function() {
        function i(e, i) { this.element = e, this.options = t.extend({}, n, i), this.globals = {}, this.$container = t(e), this.errorCheck() && this.init() }
        return i.prototype.errorCheck = function() { var t, e, i, n; return n = this.options, i = !1, e = "Shapeshift ERROR:", null === n.colWidth && (t = this.$container.children(n.selector), 0 === t.length && (i = !0, console.error("" + e + " option colWidth must be specified if Shapeshift is initialized with no active children."))), !i }, i.prototype.init = function() { return this.createEvents(), this.setGlobals(), this.setIdentifier(), this.setActiveChildren(), this.enableFeatures(), this.gridInit(), this.render(), this.afterInit() }, i.prototype.createEvents = function() { var t, e, i = this; return e = this.options, t = this.$container, t.off("ss-arrange").on("ss-arrange", function(t, e) { return null == e && (e = !1), i.render(!1, e) }), t.off("ss-rearrange").on("ss-rearrange", function() { return i.render(!0) }), t.off("ss-setTargetPosition").on("ss-setTargetPosition", function() { return i.setTargetPosition() }), t.off("ss-destroy").on("ss-destroy", function() { return i.destroy() }), t.off("ss-shuffle").on("ss-shuffle", function() { return i.shuffle() }) }, i.prototype.setGlobals = function() { return this.globals.animated = this.options.animateOnInit, this.globals.dragging = !1 }, i.prototype.afterInit = function() { return this.globals.animated = this.options.animated }, i.prototype.setIdentifier = function() { return this.identifier = "shapeshifted_container_" + Math.random().toString(36).substring(7), this.$container.addClass(this.identifier) }, i.prototype.enableFeatures = function() { return this.options.enableResize && this.enableResize(), this.options.enableDrag || this.options.enableCrossDrop ? this.enableDragNDrop() : void 0 }, i.prototype.setActiveChildren = function() { var e, i, n, s, o, r, a, l, h, c, d, u; for (a = this.options, e = this.$container.children(a.selector), i = a.activeClass, l = e.length, o = h = 0; l >= 0 ? l > h : h > l; o = l >= 0 ? ++h : --h) t(e[o]).addClass(i); for (this.setParsedChildren(), s = a.columns, u = [], o = c = 0, d = this.parsedChildren.length; d >= 0 ? d > c : c > d; o = d >= 0 ? ++c : --c) n = this.parsedChildren[o].colspan, r = a.minColumns, n > s && n > r ? (a.minColumns = n, u.push(console.error("Shapeshift ERROR: There are child elements that have a larger colspan than the minimum columns set through options.\noptions.minColumns has been set to " + n))) : u.push(void 0); return u }, i.prototype.setParsedChildren = function() { var e, i, n, s, o, r, a; for (i = this.$container.find("." + this.options.activeClass).filter(":visible"), r = i.length, o = [], s = a = 0; r >= 0 ? r > a : a > r; s = r >= 0 ? ++a : --a) e = t(i[s]), n = { i: s, el: e, colspan: parseInt(e.attr("data-ss-colspan")) || 1, height: e.outerHeight() }, o.push(n); return this.parsedChildren = o }, i.prototype.gridInit = function() { var t, e, i, n, s; return n = this.options.gutterX, this.options.colWidth >= 1 ? this.globals.col_width = this.options.colWidth + n : (i = this.parsedChildren[0], e = i.el.outerWidth(), t = i.colspan, s = (e - (t - 1) * n) / t, this.globals.col_width = s + n) }, i.prototype.render = function(t, e) { return null == t && (t = !1), t && this.setActiveChildren(), this.setGridColumns(), this.arrange(!1, e) }, i.prototype.setGridColumns = function() {
          var t, e, i, n, s, o, r, a, l, h, c, d, u, p, f;
          if (o = this.globals, d = this.options, i = o.col_width, a = d.gutterX, u = d.paddingX, h = this.$container.innerWidth() - 2 * u, c = d.minColumns, s = d.columns || Math.floor((h + a) / i), c && c > s && (s = c), o.columns = s, e = this.parsedChildren.length, s > e) {
            for (t = 0, l = p = 0, f = this.parsedChildren.length; f >= 0 ? f > p : p > f; l = f >= 0 ? ++p : --p) n = this.parsedChildren[l].colspan, s >= n + t && (t += n);
            s = t
          }
          switch (o.child_offset = u, d.align) {
            case "center":
              return r = s * i - a, o.child_offset += (h - r) / 2;
            case "right":
              return r = s * i - a, o.child_offset += h - r
          }
        }, i.prototype.arrange = function(t, e) { var i, n, s, o, r, a, l, h, c, d, u, p, f, m, g, v, y, b; for (t && this.setParsedChildren(), c = this.globals, m = this.options, n = this.$container, a = this.getPositions(), g = this.parsedChildren, y = g.length, s = c.animated && y <= m.animationThreshold, o = m.animationSpeed, h = m.draggedClass, d = b = 0; y >= 0 ? y > b : b > y; d = y >= 0 ? ++b : --b) i = g[d].el, r = a[d], u = i.hasClass(h), u && (v = m.placeholderClass, i = i.siblings("." + v)), s && !u ? i.stop(!0, !1).animate(r, o, function() {}) : i.css(r); return e && (s ? setTimeout(function() { return n.trigger("ss-drop-complete") }, o) : n.trigger("ss-drop-complete")), n.trigger("ss-arranged"), m.autoHeight ? (l = c.container_height, p = m.maxHeight, f = m.minHeight, f && f > l ? l = f : p && l > p && (l = p), n.height(l)) : void 0 }, i.prototype.getPositions = function(t) {
          var e, i, n, s, o, r, a, l, h, c, d, u, p, f, m, g, v, y, b = this;
          for (null == t && (t = !0), o = this.globals, h = this.options, a = h.gutterY, c = h.paddingY, s = h.draggedClass, d = this.parsedChildren, g = d.length, e = [], l = v = 0, y = o.columns; y >= 0 ? y > v : v > y; l = y >= 0 ? ++v : --v) e.push(c);
          return f = function(t) { var i, n, s, r, l, h, c; if (i = t.col, n = t.colspan, r = t.col * o.col_width + o.child_offset, l = e[i], u[t.i] = { left: r, top: l }, e[i] += t.height + a, n >= 1) { for (c = [], s = h = 1; n >= 1 ? n > h : h > n; s = n >= 1 ? ++h : --h) c.push(e[i + s] = e[i]); return c } }, i = function(t) {
            var i, n, s, o, r, a, l, h, c, d, u, p;
            for (c = e.length - t.colspan + 1, h = e.slice(0).splice(0, c), i = void 0, l = u = 0; c >= 0 ? c > u : u > c; l = c >= 0 ? ++u : --u) {
              for (n = b.lowestCol(h, l), s = t.colspan, o = e[n], r = !0, d = p = 1; s >= 1 ? s > p : p > s; d = s >= 1 ? ++p : --p)
                if (a = e[n + d], a > o) { r = !1; break }
              if (r) { i = n; break }
            }
            return i
          }, m = [], p = function() { var t, e, n, s, o, r, a, l, h, c; for (o = [], s = r = 0, l = m.length; l >= 0 ? l > r : r > l; s = l >= 0 ? ++r : --r) n = m[s], n.col = i(n), n.col >= 0 && (f(n), o.push(s)); for (c = [], e = a = h = o.length - 1; a >= 0; e = a += -1) t = o[e], c.push(m.splice(t, 1)); return c }, u = [], (n = function() { var n, o, r; for (r = [], l = o = 0; g >= 0 ? g > o : o > g; l = g >= 0 ? ++o : --o) n = d[l], t || !n.el.hasClass(s) ? (n.col = n.colspan > 1 ? i(n) : b.lowestCol(e), void 0 === n.col ? m.push(n) : f(n), r.push(p())) : r.push(void 0); return r })(), h.autoHeight && (r = e[this.highestCol(e)] - a, o.container_height = r + c), u
        }, i.prototype.enableDragNDrop = function() { var i, n, s, o, r, a, l, h, c, d, u, p, f, m, g, v, y, b, w = this; return f = this.options, n = this.$container, r = f.activeClass, p = f.draggedClass, g = f.placeholderClass, m = f.originalContainerClass, l = f.currentContainerClass, v = f.previousContainerClass, h = f.deleteClone, d = f.dragRate, c = f.dragClone, a = f.cloneClass, o = s = i = b = y = null, u = !1, f.enableDrag && n.children("." + r).filter(f.dragWhitelist).draggable({ addClasses: !1, containment: "document", handle: f.handle, zIndex: 9999, start: function(e) { var n; return w.globals.dragging = !0, o = t(e.target), c && (i = o.clone(!1, !1).insertBefore(o).addClass(a)), o.addClass(p), n = o.prop("tagName"), s = t("<" + n + " class='" + g + "' style='height: " + o.height() + "px; width: " + o.width() + "px'></" + n + ">"), o.parent().addClass(m).addClass(l), b = o.outerHeight() / 2, y = o.outerWidth() / 2 }, drag: function(i, n) { return u || c && h && t("." + l)[0] === t("." + m)[0] || (s.remove().appendTo("." + l), t("." + l).trigger("ss-setTargetPosition"), u = !0, e.setTimeout(function() { return u = !1 }, d)), n.position.left = i.pageX - o.parent().offset().left - y, n.position.top = i.pageY - o.parent().offset().top - b }, stop: function() { var e, n, r; return w.globals.dragging = !1, n = t("." + m), e = t("." + l), r = t("." + v), o.removeClass(p), t("." + g).remove(), c && (h && t("." + l)[0] === t("." + m)[0] ? (i.remove(), t("." + l).trigger("ss-rearrange")) : (i.removeClass(a), n.shapeshift(n.data("plugin_shapeshift").options), e.shapeshift(e.data("plugin_shapeshift").options))), n[0] === e[0] ? e.trigger("ss-rearranged", o) : (n.trigger("ss-removed", o), e.trigger("ss-added", o)), n.trigger("ss-arrange").removeClass(m), e.trigger("ss-arrange", !0).removeClass(l), r.trigger("ss-arrange").removeClass(v), o = s = null } }), f.enableCrossDrop ? n.droppable({ accept: f.crossDropWhitelist, tolerance: "intersect", over: function(e) { return t("." + v).removeClass(v), t("." + l).removeClass(l).addClass(v), t(e.target).addClass(l) }, drop: function(e, i) { var n, s, r; return w.options.enableTrash ? (s = t("." + m), n = t("." + l), r = t("." + v), o = t(i.helper), n.trigger("ss-trashed", o), o.remove(), s.trigger("ss-rearrange").removeClass(m), n.trigger("ss-rearrange").removeClass(l), r.trigger("ss-arrange").removeClass(v)) : void 0 } }) : void 0 }, i.prototype.setTargetPosition = function() {
          var e, i, n, s, o, r, a, l, h, c, d, u, p, f, m, g, v, y, b, w, _, x;
          if (c = this.options, c.enableTrash) return u = this.options.placeholderClass, t("." + u).remove();
          if (h = c.draggedClass, e = t("." + h), i = e.parent(), d = this.parsedChildren, o = this.getPositions(!1), b = o.length, m = e.offset().left - i.offset().left + this.globals.col_width / 2, g = e.offset().top - i.offset().top + e.height() / 2, v = 9999999, y = 0, b > 1) {
            for (a = c.cutoffStart + 1 || 0, r = c.cutoffEnd || b, p = x = a; r >= a ? r > x : x > r; p = r >= a ? ++x : --x) s = o[p], s && (_ = m - s.left, w = g - s.top, _ > 0 && w > 0 && (l = Math.sqrt(w * w + _ * _), v > l && (v = l, y = p, p === b - 1 && _ > d[p].height / 2 && y++)));
            y === d.length ? (n = d[y - 1].el, e.insertAfter(n)) : (n = d[y].el, e.insertBefore(n))
          } else 1 === b ? (s = o[0], s.left < m ? this.$container.append(e) : this.$container.prepend(e)) : this.$container.append(e);
          return this.arrange(!0), i[0] !== e.parent()[0] ? (f = c.previousContainerClass, 1 == t("." + f).data("plugin_shapeshift").options.enableCrossDrop ? t("." + f).trigger("ss-rearrange") : t("." + f)) : void 0
        }, i.prototype.enableResize = function() { var i, n, s, o = this; return i = this.options.animationSpeed, s = !1, n = "resize." + this.identifier, t(e).on(n, function() { return s ? void 0 : (s = !0, setTimeout(function() { return o.render() }, i / 3), setTimeout(function() { return o.render() }, i / 3), setTimeout(function() { return s = !1, o.render() }, i / 3)) }) }, i.prototype.shuffle = function() { var t; return t = function(t, e) { var i; return i = function(t) { var e, i, n; for (i = void 0, n = void 0, e = t.length; e;) i = parseInt(Math.random() * e), n = t[--e], t[e] = t[i], t[i] = n; return t }, t.each(function() { var n; return n = t.find("." + e).filter(":visible"), n.length ? t.html(i(n)) : this }) }, this.globals.dragging ? void 0 : (t(this.$container, this.options.activeClass), this.enableFeatures(), this.$container.trigger("ss-rearrange")) }, i.prototype.lowestCol = function(t, e) { var i, n, s, o; for (null == e && (e = 0), s = t.length, i = [], n = o = 0; s >= 0 ? s > o : o > s; n = s >= 0 ? ++o : --o) i.push([t[n], n]); return i.sort(function(t, e) { var i; return i = t[0] - e[0], 0 === i && (i = t[1] - e[1]), i }), i[e][1] }, i.prototype.highestCol = function(i) { return t.inArray(Math.max.apply(e, i), i) }, i.prototype.destroy = function() { var t, e, i; return e = this.$container, e.off("ss-arrange"), e.off("ss-rearrange"), e.off("ss-setTargetPosition"), e.off("ss-destroy"), i = this.options.activeClass, t = e.find("." + i), this.options.enableDrag && t.draggable("destroy"), this.options.enableCrossDrop && e.droppable("destroy"), t.removeClass(i), e.removeClass(this.identifier) }, i
      }(), t.fn[s] = function(n) { return this.each(function() { var o, r, a, l; return r = null != (a = t(this).attr("class")) && null != (l = a.match(/shapeshifted_container_\w+/)) ? l[0] : void 0, r && (o = "resize." + r, t(e).off(o), t(this).removeClass(r)), t.data(this, "plugin_" + s, new i(this, n)) }) }
    }(jQuery, window, document)
  }.call(this), ! function(t) {
    function e() {}

    function i(t) {
      function i(e) { e.prototype.option || (e.prototype.option = function(e) { t.isPlainObject(e) && (this.options = t.extend(!0, this.options, e)) }) }

      function s(e, i) {
        t.fn[e] = function(s) {
          if ("string" == typeof s) {
            for (var r = n.call(arguments, 1), a = 0, l = this.length; l > a; a++) {
              var h = this[a],
                c = t.data(h, e);
              if (c)
                if (t.isFunction(c[s]) && "_" !== s.charAt(0)) { var d = c[s].apply(c, r); if (void 0 !== d) return d } else o("no such method '" + s + "' for " + e + " instance");
              else o("cannot call methods on " + e + " prior to initialization; attempted to call '" + s + "'")
            }
            return this
          }
          return this.each(function() {
            var n = t.data(this, e);
            n ? (n.option(s), n._init()) : (n = new i(this, s), t.data(this, e, n))
          })
        }
      }
      if (t) { var o = "undefined" == typeof console ? e : function(t) { console.error(t) }; return t.bridget = function(t, e) { i(e), s(t, e) }, t.bridget }
    }
    var n = Array.prototype.slice;
    "function" == typeof define && define.amd ? define("jquery-bridget/jquery.bridget", ["jquery"], i) : i("object" == typeof exports ? require("jquery") : t.jQuery)
  }(window),
  function(t) {
    function e(e) { var i = t.event; return i.target = i.target || i.srcElement || e, i }
    var i = document.documentElement,
      n = function() {};
    i.addEventListener ? n = function(t, e, i) { t.addEventListener(e, i, !1) } : i.attachEvent && (n = function(t, i, n) {
      t[i + n] = n.handleEvent ? function() {
        var i = e(t);
        n.handleEvent.call(n, i)
      } : function() {
        var i = e(t);
        n.call(t, i)
      }, t.attachEvent("on" + i, t[i + n])
    });
    var s = function() {};
    i.removeEventListener ? s = function(t, e, i) { t.removeEventListener(e, i, !1) } : i.detachEvent && (s = function(t, e, i) { t.detachEvent("on" + e, t[e + i]); try { delete t[e + i] } catch (n) { t[e + i] = void 0 } });
    var o = { bind: n, unbind: s };
    "function" == typeof define && define.amd ? define("eventie/eventie", o) : "object" == typeof exports ? module.exports = o : t.eventie = o
  }(window),
  function() {
    "use strict";

    function t() {}

    function e(t, e) {
      for (var i = t.length; i--;)
        if (t[i].listener === e) return i;
      return -1
    }

    function i(t) { return function() { return this[t].apply(this, arguments) } }
    var n = t.prototype,
      s = this,
      o = s.EventEmitter;
    n.getListeners = function(t) { var e, i, n = this._getEvents(); if (t instanceof RegExp) { e = {}; for (i in n) n.hasOwnProperty(i) && t.test(i) && (e[i] = n[i]) } else e = n[t] || (n[t] = []); return e }, n.flattenListeners = function(t) { var e, i = []; for (e = 0; e < t.length; e += 1) i.push(t[e].listener); return i }, n.getListenersAsObject = function(t) { var e, i = this.getListeners(t); return i instanceof Array && (e = {}, e[t] = i), e || i }, n.addListener = function(t, i) {
      var n, s = this.getListenersAsObject(t),
        o = "object" == typeof i;
      for (n in s) s.hasOwnProperty(n) && -1 === e(s[n], i) && s[n].push(o ? i : { listener: i, once: !1 });
      return this
    }, n.on = i("addListener"), n.addOnceListener = function(t, e) { return this.addListener(t, { listener: e, once: !0 }) }, n.once = i("addOnceListener"), n.defineEvent = function(t) { return this.getListeners(t), this }, n.defineEvents = function(t) { for (var e = 0; e < t.length; e += 1) this.defineEvent(t[e]); return this }, n.removeListener = function(t, i) { var n, s, o = this.getListenersAsObject(t); for (s in o) o.hasOwnProperty(s) && (n = e(o[s], i), -1 !== n && o[s].splice(n, 1)); return this }, n.off = i("removeListener"), n.addListeners = function(t, e) { return this.manipulateListeners(!1, t, e) }, n.removeListeners = function(t, e) { return this.manipulateListeners(!0, t, e) }, n.manipulateListeners = function(t, e, i) {
      var n, s, o = t ? this.removeListener : this.addListener,
        r = t ? this.removeListeners : this.addListeners;
      if ("object" != typeof e || e instanceof RegExp)
        for (n = i.length; n--;) o.call(this, e, i[n]);
      else
        for (n in e) e.hasOwnProperty(n) && (s = e[n]) && ("function" == typeof s ? o.call(this, n, s) : r.call(this, n, s));
      return this
    }, n.removeEvent = function(t) {
      var e, i = typeof t,
        n = this._getEvents();
      if ("string" === i) delete n[t];
      else if (t instanceof RegExp)
        for (e in n) n.hasOwnProperty(e) && t.test(e) && delete n[e];
      else delete this._events;
      return this
    }, n.removeAllListeners = i("removeEvent"), n.emitEvent = function(t, e) {
      var i, n, s, o, r = this.getListenersAsObject(t);
      for (s in r)
        if (r.hasOwnProperty(s))
          for (n = r[s].length; n--;) i = r[s][n], i.once === !0 && this.removeListener(t, i.listener), o = i.listener.apply(this, e || []), o === this._getOnceReturnValue() && this.removeListener(t, i.listener);
      return this
    }, n.trigger = i("emitEvent"), n.emit = function(t) { var e = Array.prototype.slice.call(arguments, 1); return this.emitEvent(t, e) }, n.setOnceReturnValue = function(t) { return this._onceReturnValue = t, this }, n._getOnceReturnValue = function() { return this.hasOwnProperty("_onceReturnValue") ? this._onceReturnValue : !0 }, n._getEvents = function() { return this._events || (this._events = {}) }, t.noConflict = function() { return s.EventEmitter = o, t }, "function" == typeof define && define.amd ? define("eventEmitter/EventEmitter", [], function() { return t }) : "object" == typeof module && module.exports ? module.exports = t : s.EventEmitter = t
  }.call(this),
  function(t) {
    function e(t) {
      if (t) {
        if ("string" == typeof n[t]) return t;
        t = t.charAt(0).toUpperCase() + t.slice(1);
        for (var e, s = 0, o = i.length; o > s; s++)
          if (e = i[s] + t, "string" == typeof n[e]) return e
      }
    }
    var i = "Webkit Moz ms Ms O".split(" "),
      n = document.documentElement.style;
    "function" == typeof define && define.amd ? define("get-style-property/get-style-property", [], function() { return e }) : "object" == typeof exports ? module.exports = e : t.getStyleProperty = e
  }(window),
  function(t) {
    function e(t) {
      var e = parseFloat(t),
        i = -1 === t.indexOf("%") && !isNaN(e);
      return i && e
    }

    function i() {}

    function n() {
      for (var t = { width: 0, height: 0, innerWidth: 0, innerHeight: 0, outerWidth: 0, outerHeight: 0 }, e = 0, i = r.length; i > e; e++) {
        var n = r[e];
        t[n] = 0
      }
      return t
    }

    function s(i) {
      function s() {
        if (!u) {
          u = !0;
          var n = t.getComputedStyle;
          if (h = function() { var t = n ? function(t) { return n(t, null) } : function(t) { return t.currentStyle }; return function(e) { var i = t(e); return i || o("Style returned " + i + ". Are you running this code in a hidden iframe on Firefox? See http://bit.ly/getsizebug1"), i } }(), c = i("boxSizing")) {
            var s = document.createElement("div");
            s.style.width = "200px", s.style.padding = "1px 2px 3px 4px", s.style.borderStyle = "solid", s.style.borderWidth = "1px 2px 3px 4px", s.style[c] = "border-box";
            var r = document.body || document.documentElement;
            r.appendChild(s);
            var a = h(s);
            d = 200 === e(a.width), r.removeChild(s)
          }
        }
      }

      function a(t) {
        if (s(), "string" == typeof t && (t = document.querySelector(t)), t && "object" == typeof t && t.nodeType) {
          var i = h(t);
          if ("none" === i.display) return n();
          var o = {};
          o.width = t.offsetWidth, o.height = t.offsetHeight;
          for (var a = o.isBorderBox = !(!c || !i[c] || "border-box" !== i[c]), u = 0, p = r.length; p > u; u++) {
            var f = r[u],
              m = i[f];
            m = l(t, m);
            var g = parseFloat(m);
            o[f] = isNaN(g) ? 0 : g
          }
          var v = o.paddingLeft + o.paddingRight,
            y = o.paddingTop + o.paddingBottom,
            b = o.marginLeft + o.marginRight,
            w = o.marginTop + o.marginBottom,
            _ = o.borderLeftWidth + o.borderRightWidth,
            x = o.borderTopWidth + o.borderBottomWidth,
            k = a && d,
            C = e(i.width);
          C !== !1 && (o.width = C + (k ? 0 : v + _));
          var S = e(i.height);
          return S !== !1 && (o.height = S + (k ? 0 : y + x)), o.innerWidth = o.width - (v + _), o.innerHeight = o.height - (y + x), o.outerWidth = o.width + b, o.outerHeight = o.height + w, o
        }
      }

      function l(e, i) {
        if (t.getComputedStyle || -1 === i.indexOf("%")) return i;
        var n = e.style,
          s = n.left,
          o = e.runtimeStyle,
          r = o && o.left;
        return r && (o.left = e.currentStyle.left), n.left = i, i = n.pixelLeft, n.left = s, r && (o.left = r), i
      }
      var h, c, d, u = !1;
      return a
    }
    var o = "undefined" == typeof console ? i : function(t) { console.error(t) },
      r = ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "marginLeft", "marginRight", "marginTop", "marginBottom", "borderLeftWidth", "borderRightWidth", "borderTopWidth", "borderBottomWidth"];
    "function" == typeof define && define.amd ? define("get-size/get-size", ["get-style-property/get-style-property"], s) : "object" == typeof exports ? module.exports = s(require("desandro-get-style-property")) : t.getSize = s(t.getStyleProperty)
  }(window),
  function(t) {
    function e(t) { "function" == typeof t && (e.isReady ? t() : r.push(t)) }

    function i(t) {
      var i = "readystatechange" === t.type && "complete" !== o.readyState;
      e.isReady || i || n()
    }

    function n() {
      e.isReady = !0;
      for (var t = 0, i = r.length; i > t; t++) {
        var n = r[t];
        n()
      }
    }

    function s(s) { return "complete" === o.readyState ? n() : (s.bind(o, "DOMContentLoaded", i), s.bind(o, "readystatechange", i), s.bind(t, "load", i)), e }
    var o = t.document,
      r = [];
    e.isReady = !1, "function" == typeof define && define.amd ? define("doc-ready/doc-ready", ["eventie/eventie"], s) : "object" == typeof exports ? module.exports = s(require("eventie")) : t.docReady = s(t.eventie)
  }(window),
  function(t) {
    "use strict";

    function e(t, e) { return t[r](e) }

    function i(t) {
      if (!t.parentNode) {
        var e = document.createDocumentFragment();
        e.appendChild(t)
      }
    }

    function n(t, e) {
      i(t);
      for (var n = t.parentNode.querySelectorAll(e), s = 0, o = n.length; o > s; s++)
        if (n[s] === t) return !0;
      return !1
    }

    function s(t, n) { return i(t), e(t, n) }
    var o, r = function() {
      if (t.matches) return "matches";
      if (t.matchesSelector) return "matchesSelector";
      for (var e = ["webkit", "moz", "ms", "o"], i = 0, n = e.length; n > i; i++) {
        var s = e[i],
          o = s + "MatchesSelector";
        if (t[o]) return o
      }
    }();
    if (r) {
      var a = document.createElement("div"),
        l = e(a, "div");
      o = l ? e : s
    } else o = n;
    "function" == typeof define && define.amd ? define("matches-selector/matches-selector", [], function() { return o }) : "object" == typeof exports ? module.exports = o : window.matchesSelector = o
  }(Element.prototype),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("fizzy-ui-utils/utils", ["doc-ready/doc-ready", "matches-selector/matches-selector"], function(i, n) { return e(t, i, n) }) : "object" == typeof exports ? module.exports = e(t, require("doc-ready"), require("desandro-matches-selector")) : t.fizzyUIUtils = e(t, t.docReady, t.matchesSelector) }(window, function(t, e, i) {
    var n = {};
    n.extend = function(t, e) { for (var i in e) t[i] = e[i]; return t }, n.modulo = function(t, e) { return (t % e + e) % e };
    var s = Object.prototype.toString;
    n.isArray = function(t) { return "[object Array]" == s.call(t) }, n.makeArray = function(t) {
      var e = [];
      if (n.isArray(t)) e = t;
      else if (t && "number" == typeof t.length)
        for (var i = 0, s = t.length; s > i; i++) e.push(t[i]);
      else e.push(t);
      return e
    }, n.indexOf = Array.prototype.indexOf ? function(t, e) { return t.indexOf(e) } : function(t, e) {
      for (var i = 0, n = t.length; n > i; i++)
        if (t[i] === e) return i;
      return -1
    }, n.removeFrom = function(t, e) { var i = n.indexOf(t, e); - 1 != i && t.splice(i, 1) }, n.isElement = "function" == typeof HTMLElement || "object" == typeof HTMLElement ? function(t) { return t instanceof HTMLElement } : function(t) { return t && "object" == typeof t && 1 == t.nodeType && "string" == typeof t.nodeName }, n.setText = function() {
      function t(t, i) { e = e || (void 0 !== document.documentElement.textContent ? "textContent" : "innerText"), t[e] = i }
      var e;
      return t
    }(), n.getParent = function(t, e) {
      for (; t != document.body;)
        if (t = t.parentNode, i(t, e)) return t
    }, n.getQueryElement = function(t) { return "string" == typeof t ? document.querySelector(t) : t }, n.handleEvent = function(t) {
      var e = "on" + t.type;
      this[e] && this[e](t)
    }, n.filterFindElements = function(t, e) {
      t = n.makeArray(t);
      for (var s = [], o = 0, r = t.length; r > o; o++) {
        var a = t[o];
        if (n.isElement(a))
          if (e) { i(a, e) && s.push(a); for (var l = a.querySelectorAll(e), h = 0, c = l.length; c > h; h++) s.push(l[h]) } else s.push(a)
      }
      return s
    }, n.debounceMethod = function(t, e, i) {
      var n = t.prototype[e],
        s = e + "Timeout";
      t.prototype[e] = function() {
        var t = this[s];
        t && clearTimeout(t);
        var e = arguments,
          o = this;
        this[s] = setTimeout(function() { n.apply(o, e), delete o[s] }, i || 100)
      }
    }, n.toDashed = function(t) { return t.replace(/(.)([A-Z])/g, function(t, e, i) { return e + "-" + i }).toLowerCase() };
    var o = t.console;
    return n.htmlInit = function(i, s) {
      e(function() {
        for (var e = n.toDashed(s), r = document.querySelectorAll(".js-" + e), a = "data-" + e + "-options", l = 0, h = r.length; h > l; l++) {
          var c, d = r[l],
            u = d.getAttribute(a);
          try { c = u && JSON.parse(u) } catch (p) { o && o.error("Error parsing " + a + " on " + d.nodeName.toLowerCase() + (d.id ? "#" + d.id : "") + ": " + p); continue }
          var f = new i(d, c),
            m = t.jQuery;
          m && m.data(d, s, f)
        }
      })
    }, n
  }),
  function(t, e) {
    "use strict";
    "function" == typeof define && define.amd ? define("outlayer/item", ["eventEmitter/EventEmitter", "get-size/get-size", "get-style-property/get-style-property", "fizzy-ui-utils/utils"], function(i, n, s, o) { return e(t, i, n, s, o) }) : "object" == typeof exports ? module.exports = e(t, require("wolfy87-eventemitter"), require("get-size"), require("desandro-get-style-property"), require("fizzy-ui-utils")) : (t.Outlayer = {}, t.Outlayer.Item = e(t, t.EventEmitter, t.getSize, t.getStyleProperty, t.fizzyUIUtils))
  }(window, function(t, e, i, n, s) {
    "use strict";

    function o(t) { for (var e in t) return !1; return e = null, !0 }

    function r(t, e) { t && (this.element = t, this.layout = e, this.position = { x: 0, y: 0 }, this._create()) }

    function a(t) { return t.replace(/([A-Z])/g, function(t) { return "-" + t.toLowerCase() }) }
    var l = t.getComputedStyle,
      h = l ? function(t) { return l(t, null) } : function(t) { return t.currentStyle },
      c = n("transition"),
      d = n("transform"),
      u = c && d,
      p = !!n("perspective"),
      f = { WebkitTransition: "webkitTransitionEnd", MozTransition: "transitionend", OTransition: "otransitionend", transition: "transitionend" }[c],
      m = ["transform", "transition", "transitionDuration", "transitionProperty"],
      g = function() {
        for (var t = {}, e = 0, i = m.length; i > e; e++) {
          var s = m[e],
            o = n(s);
          o && o !== s && (t[s] = o)
        }
        return t
      }();
    s.extend(r.prototype, e.prototype), r.prototype._create = function() { this._transn = { ingProperties: {}, clean: {}, onEnd: {} }, this.css({ position: "absolute" }) }, r.prototype.handleEvent = function(t) {
      var e = "on" + t.type;
      this[e] && this[e](t)
    }, r.prototype.getSize = function() { this.size = i(this.element) }, r.prototype.css = function(t) {
      var e = this.element.style;
      for (var i in t) {
        var n = g[i] || i;
        e[n] = t[i]
      }
    }, r.prototype.getPosition = function() {
      var t = h(this.element),
        e = this.layout.options,
        i = e.isOriginLeft,
        n = e.isOriginTop,
        s = t[i ? "left" : "right"],
        o = t[n ? "top" : "bottom"],
        r = this.layout.size,
        a = -1 != s.indexOf("%") ? parseFloat(s) / 100 * r.width : parseInt(s, 10),
        l = -1 != o.indexOf("%") ? parseFloat(o) / 100 * r.height : parseInt(o, 10);
      a = isNaN(a) ? 0 : a, l = isNaN(l) ? 0 : l, a -= i ? r.paddingLeft : r.paddingRight, l -= n ? r.paddingTop : r.paddingBottom, this.position.x = a, this.position.y = l
    }, r.prototype.layoutPosition = function() {
      var t = this.layout.size,
        e = this.layout.options,
        i = {},
        n = e.isOriginLeft ? "paddingLeft" : "paddingRight",
        s = e.isOriginLeft ? "left" : "right",
        o = e.isOriginLeft ? "right" : "left",
        r = this.position.x + t[n];
      i[s] = this.getXValue(r), i[o] = "";
      var a = e.isOriginTop ? "paddingTop" : "paddingBottom",
        l = e.isOriginTop ? "top" : "bottom",
        h = e.isOriginTop ? "bottom" : "top",
        c = this.position.y + t[a];
      i[l] = this.getYValue(c), i[h] = "", this.css(i), this.emitEvent("layout", [this])
    }, r.prototype.getXValue = function(t) { var e = this.layout.options; return e.percentPosition && !e.isHorizontal ? t / this.layout.size.width * 100 + "%" : t + "px" }, r.prototype.getYValue = function(t) { var e = this.layout.options; return e.percentPosition && e.isHorizontal ? t / this.layout.size.height * 100 + "%" : t + "px" }, r.prototype._transitionTo = function(t, e) {
      this.getPosition();
      var i = this.position.x,
        n = this.position.y,
        s = parseInt(t, 10),
        o = parseInt(e, 10),
        r = s === this.position.x && o === this.position.y;
      if (this.setPosition(t, e), r && !this.isTransitioning) return void this.layoutPosition();
      var a = t - i,
        l = e - n,
        h = {};
      h.transform = this.getTranslate(a, l), this.transition({ to: h, onTransitionEnd: { transform: this.layoutPosition }, isCleaning: !0 })
    }, r.prototype.getTranslate = function(t, e) { var i = this.layout.options; return t = i.isOriginLeft ? t : -t, e = i.isOriginTop ? e : -e, p ? "translate3d(" + t + "px, " + e + "px, 0)" : "translate(" + t + "px, " + e + "px)" }, r.prototype.goTo = function(t, e) { this.setPosition(t, e), this.layoutPosition() }, r.prototype.moveTo = u ? r.prototype._transitionTo : r.prototype.goTo, r.prototype.setPosition = function(t, e) { this.position.x = parseInt(t, 10), this.position.y = parseInt(e, 10) }, r.prototype._nonTransition = function(t) { this.css(t.to), t.isCleaning && this._removeStyles(t.to); for (var e in t.onTransitionEnd) t.onTransitionEnd[e].call(this) }, r.prototype._transition = function(t) {
      if (!parseFloat(this.layout.options.transitionDuration)) return void this._nonTransition(t);
      var e = this._transn;
      for (var i in t.onTransitionEnd) e.onEnd[i] = t.onTransitionEnd[i];
      for (i in t.to) e.ingProperties[i] = !0, t.isCleaning && (e.clean[i] = !0);
      if (t.from) {
        this.css(t.from);
        var n = this.element.offsetHeight;
        n = null
      }
      this.enableTransition(t.to), this.css(t.to), this.isTransitioning = !0
    };
    var v = "opacity," + a(g.transform || "transform");
    r.prototype.enableTransition = function() { this.isTransitioning || (this.css({ transitionProperty: v, transitionDuration: this.layout.options.transitionDuration }), this.element.addEventListener(f, this, !1)) }, r.prototype.transition = r.prototype[c ? "_transition" : "_nonTransition"], r.prototype.onwebkitTransitionEnd = function(t) { this.ontransitionend(t) }, r.prototype.onotransitionend = function(t) { this.ontransitionend(t) };
    var y = { "-webkit-transform": "transform", "-moz-transform": "transform", "-o-transform": "transform" };
    r.prototype.ontransitionend = function(t) {
      if (t.target === this.element) {
        var e = this._transn,
          i = y[t.propertyName] || t.propertyName;
        if (delete e.ingProperties[i], o(e.ingProperties) && this.disableTransition(), i in e.clean && (this.element.style[t.propertyName] = "", delete e.clean[i]), i in e.onEnd) {
          var n = e.onEnd[i];
          n.call(this), delete e.onEnd[i]
        }
        this.emitEvent("transitionEnd", [this])
      }
    }, r.prototype.disableTransition = function() { this.removeTransitionStyles(), this.element.removeEventListener(f, this, !1), this.isTransitioning = !1 }, r.prototype._removeStyles = function(t) {
      var e = {};
      for (var i in t) e[i] = "";
      this.css(e)
    };
    var b = { transitionProperty: "", transitionDuration: "" };
    return r.prototype.removeTransitionStyles = function() { this.css(b) }, r.prototype.removeElem = function() { this.element.parentNode.removeChild(this.element), this.css({ display: "" }), this.emitEvent("remove", [this]) }, r.prototype.remove = function() {
      if (!c || !parseFloat(this.layout.options.transitionDuration)) return void this.removeElem();
      var t = this;
      this.once("transitionEnd", function() { t.removeElem() }), this.hide()
    }, r.prototype.reveal = function() {
      delete this.isHidden, this.css({ display: "" });
      var t = this.layout.options,
        e = {},
        i = this.getHideRevealTransitionEndProperty("visibleStyle");
      e[i] = this.onRevealTransitionEnd, this.transition({ from: t.hiddenStyle, to: t.visibleStyle, isCleaning: !0, onTransitionEnd: e })
    }, r.prototype.onRevealTransitionEnd = function() { this.isHidden || this.emitEvent("reveal") }, r.prototype.getHideRevealTransitionEndProperty = function(t) { var e = this.layout.options[t]; if (e.opacity) return "opacity"; for (var i in e) return i }, r.prototype.hide = function() {
      this.isHidden = !0, this.css({ display: "" });
      var t = this.layout.options,
        e = {},
        i = this.getHideRevealTransitionEndProperty("hiddenStyle");
      e[i] = this.onHideTransitionEnd, this.transition({ from: t.visibleStyle, to: t.hiddenStyle, isCleaning: !0, onTransitionEnd: e })
    }, r.prototype.onHideTransitionEnd = function() { this.isHidden && (this.css({ display: "none" }), this.emitEvent("hide")) }, r.prototype.destroy = function() { this.css({ position: "", left: "", right: "", top: "", bottom: "", transition: "", transform: "" }) }, r
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("outlayer/outlayer", ["eventie/eventie", "eventEmitter/EventEmitter", "get-size/get-size", "fizzy-ui-utils/utils", "./item"], function(i, n, s, o, r) { return e(t, i, n, s, o, r) }) : "object" == typeof exports ? module.exports = e(t, require("eventie"), require("wolfy87-eventemitter"), require("get-size"), require("fizzy-ui-utils"), require("./item")) : t.Outlayer = e(t, t.eventie, t.EventEmitter, t.getSize, t.fizzyUIUtils, t.Outlayer.Item) }(window, function(t, e, i, n, s, o) {
    "use strict";

    function r(t, e) {
      var i = s.getQueryElement(t);
      if (!i) return void(a && a.error("Bad element for " + this.constructor.namespace + ": " + (i || t)));
      this.element = i, l && (this.$element = l(this.element)), this.options = s.extend({}, this.constructor.defaults), this.option(e);
      var n = ++c;
      this.element.outlayerGUID = n, d[n] = this, this._create(), this.options.isInitLayout && this.layout()
    }
    var a = t.console,
      l = t.jQuery,
      h = function() {},
      c = 0,
      d = {};
    return r.namespace = "outlayer", r.Item = o, r.defaults = { containerStyle: { position: "relative" }, isInitLayout: !0, isOriginLeft: !0, isOriginTop: !0, isResizeBound: !0, isResizingContainer: !0, transitionDuration: "0.4s", hiddenStyle: { opacity: 0, transform: "scale(0.001)" }, visibleStyle: { opacity: 1, transform: "scale(1)" } }, s.extend(r.prototype, i.prototype), r.prototype.option = function(t) { s.extend(this.options, t) }, r.prototype._create = function() { this.reloadItems(), this.stamps = [], this.stamp(this.options.stamp), s.extend(this.element.style, this.options.containerStyle), this.options.isResizeBound && this.bindResize() }, r.prototype.reloadItems = function() { this.items = this._itemize(this.element.children) }, r.prototype._itemize = function(t) {
      for (var e = this._filterFindItemElements(t), i = this.constructor.Item, n = [], s = 0, o = e.length; o > s; s++) {
        var r = e[s],
          a = new i(r, this);
        n.push(a)
      }
      return n
    }, r.prototype._filterFindItemElements = function(t) { return s.filterFindElements(t, this.options.itemSelector) }, r.prototype.getItemElements = function() { for (var t = [], e = 0, i = this.items.length; i > e; e++) t.push(this.items[e].element); return t }, r.prototype.layout = function() {
      this._resetLayout(), this._manageStamps();
      var t = void 0 !== this.options.isLayoutInstant ? this.options.isLayoutInstant : !this._isLayoutInited;
      this.layoutItems(this.items, t), this._isLayoutInited = !0
    }, r.prototype._init = r.prototype.layout, r.prototype._resetLayout = function() { this.getSize() }, r.prototype.getSize = function() { this.size = n(this.element) }, r.prototype._getMeasurement = function(t, e) {
      var i, o = this.options[t];
      o ? ("string" == typeof o ? i = this.element.querySelector(o) : s.isElement(o) && (i = o), this[t] = i ? n(i)[e] : o) : this[t] = 0
    }, r.prototype.layoutItems = function(t, e) { t = this._getItemsForLayout(t), this._layoutItems(t, e), this._postLayout() }, r.prototype._getItemsForLayout = function(t) {
      for (var e = [], i = 0, n = t.length; n > i; i++) {
        var s = t[i];
        s.isIgnored || e.push(s)
      }
      return e
    }, r.prototype._layoutItems = function(t, e) {
      if (this._emitCompleteOnItems("layout", t), t && t.length) {
        for (var i = [], n = 0, s = t.length; s > n; n++) {
          var o = t[n],
            r = this._getItemLayoutPosition(o);
          r.item = o, r.isInstant = e || o.isLayoutInstant, i.push(r)
        }
        this._processLayoutQueue(i)
      }
    }, r.prototype._getItemLayoutPosition = function() { return { x: 0, y: 0 } }, r.prototype._processLayoutQueue = function(t) {
      for (var e = 0, i = t.length; i > e; e++) {
        var n = t[e];
        this._positionItem(n.item, n.x, n.y, n.isInstant)
      }
    }, r.prototype._positionItem = function(t, e, i, n) { n ? t.goTo(e, i) : t.moveTo(e, i) }, r.prototype._postLayout = function() { this.resizeContainer() }, r.prototype.resizeContainer = function() {
      if (this.options.isResizingContainer) {
        var t = this._getContainerSize();
        t && (this._setContainerMeasure(t.width, !0), this._setContainerMeasure(t.height, !1))
      }
    }, r.prototype._getContainerSize = h, r.prototype._setContainerMeasure = function(t, e) {
      if (void 0 !== t) {
        var i = this.size;
        i.isBorderBox && (t += e ? i.paddingLeft + i.paddingRight + i.borderLeftWidth + i.borderRightWidth : i.paddingBottom + i.paddingTop + i.borderTopWidth + i.borderBottomWidth), t = Math.max(t, 0), this.element.style[e ? "width" : "height"] = t + "px"
      }
    }, r.prototype._emitCompleteOnItems = function(t, e) {
      function i() { s.dispatchEvent(t + "Complete", null, [e]) }

      function n() { r++, r === o && i() }
      var s = this,
        o = e.length;
      if (!e || !o) return void i();
      for (var r = 0, a = 0, l = e.length; l > a; a++) {
        var h = e[a];
        h.once(t, n)
      }
    }, r.prototype.dispatchEvent = function(t, e, i) {
      var n = e ? [e].concat(i) : i;
      if (this.emitEvent(t, n), l)
        if (this.$element = this.$element || l(this.element), e) {
          var s = l.Event(e);
          s.type = t, this.$element.trigger(s, i)
        } else this.$element.trigger(t, i)
    }, r.prototype.ignore = function(t) {
      var e = this.getItem(t);
      e && (e.isIgnored = !0)
    }, r.prototype.unignore = function(t) {
      var e = this.getItem(t);
      e && delete e.isIgnored
    }, r.prototype.stamp = function(t) {
      if (t = this._find(t)) {
        this.stamps = this.stamps.concat(t);
        for (var e = 0, i = t.length; i > e; e++) {
          var n = t[e];
          this.ignore(n)
        }
      }
    }, r.prototype.unstamp = function(t) {
      if (t = this._find(t))
        for (var e = 0, i = t.length; i > e; e++) {
          var n = t[e];
          s.removeFrom(this.stamps, n), this.unignore(n)
        }
    }, r.prototype._find = function(t) { return t ? ("string" == typeof t && (t = this.element.querySelectorAll(t)), t = s.makeArray(t)) : void 0 }, r.prototype._manageStamps = function() {
      if (this.stamps && this.stamps.length) {
        this._getBoundingRect();
        for (var t = 0, e = this.stamps.length; e > t; t++) {
          var i = this.stamps[t];
          this._manageStamp(i)
        }
      }
    }, r.prototype._getBoundingRect = function() {
      var t = this.element.getBoundingClientRect(),
        e = this.size;
      this._boundingRect = { left: t.left + e.paddingLeft + e.borderLeftWidth, top: t.top + e.paddingTop + e.borderTopWidth, right: t.right - (e.paddingRight + e.borderRightWidth), bottom: t.bottom - (e.paddingBottom + e.borderBottomWidth) }
    }, r.prototype._manageStamp = h, r.prototype._getElementOffset = function(t) {
      var e = t.getBoundingClientRect(),
        i = this._boundingRect,
        s = n(t),
        o = { left: e.left - i.left - s.marginLeft, top: e.top - i.top - s.marginTop, right: i.right - e.right - s.marginRight, bottom: i.bottom - e.bottom - s.marginBottom };
      return o
    }, r.prototype.handleEvent = function(t) {
      var e = "on" + t.type;
      this[e] && this[e](t)
    }, r.prototype.bindResize = function() { this.isResizeBound || (e.bind(t, "resize", this), this.isResizeBound = !0) }, r.prototype.unbindResize = function() { this.isResizeBound && e.unbind(t, "resize", this), this.isResizeBound = !1 }, r.prototype.onresize = function() {
      function t() { e.resize(), delete e.resizeTimeout } this.resizeTimeout && clearTimeout(this.resizeTimeout);
      var e = this;
      this.resizeTimeout = setTimeout(t, 100)
    }, r.prototype.resize = function() { this.isResizeBound && this.needsResizeLayout() && this.layout() }, r.prototype.needsResizeLayout = function() {
      var t = n(this.element),
        e = this.size && t;
      return e && t.innerWidth !== this.size.innerWidth
    }, r.prototype.addItems = function(t) { var e = this._itemize(t); return e.length && (this.items = this.items.concat(e)), e }, r.prototype.appended = function(t) {
      var e = this.addItems(t);
      e.length && (this.layoutItems(e, !0), this.reveal(e))
    }, r.prototype.prepended = function(t) {
      var e = this._itemize(t);
      if (e.length) {
        var i = this.items.slice(0);
        this.items = e.concat(i), this._resetLayout(), this._manageStamps(), this.layoutItems(e, !0), this.reveal(e), this.layoutItems(i)
      }
    }, r.prototype.reveal = function(t) {
      this._emitCompleteOnItems("reveal", t);
      for (var e = t && t.length, i = 0; e && e > i; i++) {
        var n = t[i];
        n.reveal()
      }
    }, r.prototype.hide = function(t) {
      this._emitCompleteOnItems("hide", t);
      for (var e = t && t.length, i = 0; e && e > i; i++) {
        var n = t[i];
        n.hide()
      }
    }, r.prototype.revealItemElements = function(t) {
      var e = this.getItems(t);
      this.reveal(e)
    }, r.prototype.hideItemElements = function(t) {
      var e = this.getItems(t);
      this.hide(e)
    }, r.prototype.getItem = function(t) { for (var e = 0, i = this.items.length; i > e; e++) { var n = this.items[e]; if (n.element === t) return n } }, r.prototype.getItems = function(t) {
      t = s.makeArray(t);
      for (var e = [], i = 0, n = t.length; n > i; i++) {
        var o = t[i],
          r = this.getItem(o);
        r && e.push(r)
      }
      return e
    }, r.prototype.remove = function(t) {
      var e = this.getItems(t);
      if (this._emitCompleteOnItems("remove", e), e && e.length)
        for (var i = 0, n = e.length; n > i; i++) {
          var o = e[i];
          o.remove(), s.removeFrom(this.items, o)
        }
    }, r.prototype.destroy = function() {
      var t = this.element.style;
      t.height = "", t.position = "", t.width = "";
      for (var e = 0, i = this.items.length; i > e; e++) {
        var n = this.items[e];
        n.destroy()
      }
      this.unbindResize();
      var s = this.element.outlayerGUID;
      delete d[s], delete this.element.outlayerGUID, l && l.removeData(this.element, this.constructor.namespace)
    }, r.data = function(t) { t = s.getQueryElement(t); var e = t && t.outlayerGUID; return e && d[e] }, r.create = function(t, e) {
      function i() { r.apply(this, arguments) }
      return Object.create ? i.prototype = Object.create(r.prototype) : s.extend(i.prototype, r.prototype), i.prototype.constructor = i, i.defaults = s.extend({}, r.defaults), s.extend(i.defaults, e), i.prototype.settings = {}, i.namespace = t, i.data = r.data, i.Item = function() { o.apply(this, arguments) }, i.Item.prototype = new o, s.htmlInit(i, t), l && l.bridget && l.bridget(t, i), i
    }, r.Item = o, r
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("isotope/js/item", ["outlayer/outlayer"], e) : "object" == typeof exports ? module.exports = e(require("outlayer")) : (t.Isotope = t.Isotope || {}, t.Isotope.Item = e(t.Outlayer)) }(window, function(t) {
    "use strict";

    function e() { t.Item.apply(this, arguments) } e.prototype = new t.Item, e.prototype._create = function() { this.id = this.layout.itemGUID++, t.Item.prototype._create.call(this), this.sortData = {} }, e.prototype.updateSortData = function() {
      if (!this.isIgnored) {
        this.sortData.id = this.id, this.sortData["original-order"] = this.id, this.sortData.random = Math.random();
        var t = this.layout.options.getSortData,
          e = this.layout._sorters;
        for (var i in t) {
          var n = e[i];
          this.sortData[i] = n(this.element, this)
        }
      }
    };
    var i = e.prototype.destroy;
    return e.prototype.destroy = function() { i.apply(this, arguments), this.css({ display: "" }) }, e
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("isotope/js/layout-mode", ["get-size/get-size", "outlayer/outlayer"], e) : "object" == typeof exports ? module.exports = e(require("get-size"), require("outlayer")) : (t.Isotope = t.Isotope || {}, t.Isotope.LayoutMode = e(t.getSize, t.Outlayer)) }(window, function(t, e) {
    "use strict";

    function i(t) { this.isotope = t, t && (this.options = t.options[this.namespace], this.element = t.element, this.items = t.filteredItems, this.size = t.size) }
    return function() {
      function t(t) { return function() { return e.prototype[t].apply(this.isotope, arguments) } }
      for (var n = ["_resetLayout", "_getItemLayoutPosition", "_manageStamp", "_getContainerSize", "_getElementOffset", "needsResizeLayout"], s = 0, o = n.length; o > s; s++) {
        var r = n[s];
        i.prototype[r] = t(r)
      }
    }(), i.prototype.needsVerticalResizeLayout = function() {
      var e = t(this.isotope.element),
        i = this.isotope.size && e;
      return i && e.innerHeight != this.isotope.size.innerHeight
    }, i.prototype._getMeasurement = function() { this.isotope._getMeasurement.apply(this, arguments) }, i.prototype.getColumnWidth = function() { this.getSegmentSize("column", "Width") }, i.prototype.getRowHeight = function() { this.getSegmentSize("row", "Height") }, i.prototype.getSegmentSize = function(t, e) {
      var i = t + e,
        n = "outer" + e;
      if (this._getMeasurement(i, n), !this[i]) {
        var s = this.getFirstItemSize();
        this[i] = s && s[n] || this.isotope.size["inner" + e]
      }
    }, i.prototype.getFirstItemSize = function() { var e = this.isotope.filteredItems[0]; return e && e.element && t(e.element) }, i.prototype.layout = function() { this.isotope.layout.apply(this.isotope, arguments) }, i.prototype.getSize = function() { this.isotope.getSize(), this.size = this.isotope.size }, i.modes = {}, i.create = function(t, e) {
      function n() { i.apply(this, arguments) }
      return n.prototype = new i, e && (n.options = e), n.prototype.namespace = t, i.modes[t] = n, n
    }, i
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("masonry/masonry", ["outlayer/outlayer", "get-size/get-size", "fizzy-ui-utils/utils"], e) : "object" == typeof exports ? module.exports = e(require("outlayer"), require("get-size"), require("fizzy-ui-utils")) : t.Masonry = e(t.Outlayer, t.getSize, t.fizzyUIUtils) }(window, function(t, e, i) {
    var n = t.create("masonry");
    return n.prototype._resetLayout = function() {
      this.getSize(), this._getMeasurement("columnWidth", "outerWidth"), this._getMeasurement("gutter", "outerWidth"), this.measureColumns();
      var t = this.cols;
      for (this.colYs = []; t--;) this.colYs.push(0);
      this.maxY = 0
    }, n.prototype.measureColumns = function() {
      if (this.getContainerWidth(), !this.columnWidth) {
        var t = this.items[0],
          i = t && t.element;
        this.columnWidth = i && e(i).outerWidth || this.containerWidth
      }
      var n = this.columnWidth += this.gutter,
        s = this.containerWidth + this.gutter,
        o = s / n,
        r = n - s % n,
        a = r && 1 > r ? "round" : "floor";
      o = Math[a](o), this.cols = Math.max(o, 1)
    }, n.prototype.getContainerWidth = function() {
      var t = this.options.isFitWidth ? this.element.parentNode : this.element,
        i = e(t);
      this.containerWidth = i && i.innerWidth
    }, n.prototype._getItemLayoutPosition = function(t) {
      t.getSize();
      var e = t.size.outerWidth % this.columnWidth,
        n = e && 1 > e ? "round" : "ceil",
        s = Math[n](t.size.outerWidth / this.columnWidth);
      s = Math.min(s, this.cols);
      for (var o = this._getColGroup(s), r = Math.min.apply(Math, o), a = i.indexOf(o, r), l = { x: this.columnWidth * a, y: r }, h = r + t.size.outerHeight, c = this.cols + 1 - o.length, d = 0; c > d; d++) this.colYs[a + d] = h;
      return l
    }, n.prototype._getColGroup = function(t) {
      if (2 > t) return this.colYs;
      for (var e = [], i = this.cols + 1 - t, n = 0; i > n; n++) {
        var s = this.colYs.slice(n, n + t);
        e[n] = Math.max.apply(Math, s)
      }
      return e
    }, n.prototype._manageStamp = function(t) {
      var i = e(t),
        n = this._getElementOffset(t),
        s = this.options.isOriginLeft ? n.left : n.right,
        o = s + i.outerWidth,
        r = Math.floor(s / this.columnWidth);
      r = Math.max(0, r);
      var a = Math.floor(o / this.columnWidth);
      a -= o % this.columnWidth ? 0 : 1, a = Math.min(this.cols - 1, a);
      for (var l = (this.options.isOriginTop ? n.top : n.bottom) + i.outerHeight, h = r; a >= h; h++) this.colYs[h] = Math.max(l, this.colYs[h])
    }, n.prototype._getContainerSize = function() { this.maxY = Math.max.apply(Math, this.colYs); var t = { height: this.maxY }; return this.options.isFitWidth && (t.width = this._getContainerFitWidth()), t }, n.prototype._getContainerFitWidth = function() { for (var t = 0, e = this.cols; --e && 0 === this.colYs[e];) t++; return (this.cols - t) * this.columnWidth - this.gutter }, n.prototype.needsResizeLayout = function() { var t = this.containerWidth; return this.getContainerWidth(), t !== this.containerWidth }, n
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("isotope/js/layout-modes/masonry", ["../layout-mode", "masonry/masonry"], e) : "object" == typeof exports ? module.exports = e(require("../layout-mode"), require("masonry-layout")) : e(t.Isotope.LayoutMode, t.Masonry) }(window, function(t, e) {
    "use strict";

    function i(t, e) { for (var i in e) t[i] = e[i]; return t }
    var n = t.create("masonry"),
      s = n.prototype._getElementOffset,
      o = n.prototype.layout,
      r = n.prototype._getMeasurement;
    i(n.prototype, e.prototype), n.prototype._getElementOffset = s, n.prototype.layout = o, n.prototype._getMeasurement = r;
    var a = n.prototype.measureColumns;
    n.prototype.measureColumns = function() { this.items = this.isotope.filteredItems, a.call(this) };
    var l = n.prototype._manageStamp;
    return n.prototype._manageStamp = function() { this.options.isOriginLeft = this.isotope.options.isOriginLeft, this.options.isOriginTop = this.isotope.options.isOriginTop, l.apply(this, arguments) }, n
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("isotope/js/layout-modes/fit-rows", ["../layout-mode"], e) : "object" == typeof exports ? module.exports = e(require("../layout-mode")) : e(t.Isotope.LayoutMode) }(window, function(t) {
    "use strict";
    var e = t.create("fitRows");
    return e.prototype._resetLayout = function() { this.x = 0, this.y = 0, this.maxY = 0, this._getMeasurement("gutter", "outerWidth") }, e.prototype._getItemLayoutPosition = function(t) {
      t.getSize();
      var e = t.size.outerWidth + this.gutter,
        i = this.isotope.size.innerWidth + this.gutter;
      0 !== this.x && e + this.x > i && (this.x = 0, this.y = this.maxY);
      var n = { x: this.x, y: this.y };
      return this.maxY = Math.max(this.maxY, this.y + t.size.outerHeight), this.x += e, n
    }, e.prototype._getContainerSize = function() { return { height: this.maxY } }, e
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define("isotope/js/layout-modes/vertical", ["../layout-mode"], e) : "object" == typeof exports ? module.exports = e(require("../layout-mode")) : e(t.Isotope.LayoutMode) }(window, function(t) {
    "use strict";
    var e = t.create("vertical", { horizontalAlignment: 0 });
    return e.prototype._resetLayout = function() { this.y = 0 }, e.prototype._getItemLayoutPosition = function(t) {
      t.getSize();
      var e = (this.isotope.size.innerWidth - t.size.outerWidth) * this.options.horizontalAlignment,
        i = this.y;
      return this.y += t.size.outerHeight, { x: e, y: i }
    }, e.prototype._getContainerSize = function() { return { height: this.y } }, e
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define(["outlayer/outlayer", "get-size/get-size", "matches-selector/matches-selector", "fizzy-ui-utils/utils", "isotope/js/item", "isotope/js/layout-mode", "isotope/js/layout-modes/masonry", "isotope/js/layout-modes/fit-rows", "isotope/js/layout-modes/vertical"], function(i, n, s, o, r, a) { return e(t, i, n, s, o, r, a) }) : "object" == typeof exports ? module.exports = e(t, require("outlayer"), require("get-size"), require("desandro-matches-selector"), require("fizzy-ui-utils"), require("./item"), require("./layout-mode"), require("./layout-modes/masonry"), require("./layout-modes/fit-rows"), require("./layout-modes/vertical")) : t.Isotope = e(t, t.Outlayer, t.getSize, t.matchesSelector, t.fizzyUIUtils, t.Isotope.Item, t.Isotope.LayoutMode) }(window, function(t, e, i, n, s, o, r) {
    function a(t, e) {
      return function(i, n) {
        for (var s = 0, o = t.length; o > s; s++) {
          var r = t[s],
            a = i.sortData[r],
            l = n.sortData[r];
          if (a > l || l > a) {
            var h = void 0 !== e[r] ? e[r] : e,
              c = h ? 1 : -1;
            return (a > l ? 1 : -1) * c
          }
        }
        return 0
      }
    }
    var l = t.jQuery,
      h = String.prototype.trim ? function(t) { return t.trim() } : function(t) { return t.replace(/^\s+|\s+$/g, "") },
      c = document.documentElement,
      d = c.textContent ? function(t) { return t.textContent } : function(t) { return t.innerText },
      u = e.create("isotope", { layoutMode: "masonry", isJQueryFiltering: !0, sortAscending: !0 });
    u.Item = o, u.LayoutMode = r, u.prototype._create = function() { this.itemGUID = 0, this._sorters = {}, this._getSorters(), e.prototype._create.call(this), this.modes = {}, this.filteredItems = this.items, this.sortHistory = ["original-order"]; for (var t in r.modes) this._initLayoutMode(t) }, u.prototype.reloadItems = function() { this.itemGUID = 0, e.prototype.reloadItems.call(this) }, u.prototype._itemize = function() {
      for (var t = e.prototype._itemize.apply(this, arguments), i = 0, n = t.length; n > i; i++) {
        var s = t[i];
        s.id = this.itemGUID++
      }
      return this._updateItemsSortData(t), t
    }, u.prototype._initLayoutMode = function(t) {
      var e = r.modes[t],
        i = this.options[t] || {};
      this.options[t] = e.options ? s.extend(e.options, i) : i, this.modes[t] = new e(this)
    }, u.prototype.layout = function() { return !this._isLayoutInited && this.options.isInitLayout ? void this.arrange() : void this._layout() }, u.prototype._layout = function() {
      var t = this._getIsInstant();
      this._resetLayout(), this._manageStamps(), this.layoutItems(this.filteredItems, t), this._isLayoutInited = !0
    }, u.prototype.arrange = function(t) {
      function e() { n.reveal(i.needReveal), n.hide(i.needHide) } this.option(t), this._getIsInstant();
      var i = this._filter(this.items);
      this.filteredItems = i.matches;
      var n = this;
      this._bindArrangeComplete(), this._isInstant ? this._noTransition(e) : e(), this._sort(), this._layout()
    }, u.prototype._init = u.prototype.arrange, u.prototype._getIsInstant = function() { var t = void 0 !== this.options.isLayoutInstant ? this.options.isLayoutInstant : !this._isLayoutInited; return this._isInstant = t, t }, u.prototype._bindArrangeComplete = function() {
      function t() { e && i && n && s.dispatchEvent("arrangeComplete", null, [s.filteredItems]) }
      var e, i, n, s = this;
      this.once("layoutComplete", function() { e = !0, t() }), this.once("hideComplete", function() { i = !0, t() }), this.once("revealComplete", function() { n = !0, t() })
    }, u.prototype._filter = function(t) {
      var e = this.options.filter;
      e = e || "*";
      for (var i = [], n = [], s = [], o = this._getFilterTest(e), r = 0, a = t.length; a > r; r++) {
        var l = t[r];
        if (!l.isIgnored) {
          var h = o(l);
          h && i.push(l), h && l.isHidden ? n.push(l) : h || l.isHidden || s.push(l)
        }
      }
      return { matches: i, needReveal: n, needHide: s }
    }, u.prototype._getFilterTest = function(t) { return l && this.options.isJQueryFiltering ? function(e) { return l(e.element).is(t) } : "function" == typeof t ? function(e) { return t(e.element) } : function(e) { return n(e.element, t) } }, u.prototype.updateSortData = function(t) {
      var e;
      t ? (t = s.makeArray(t), e = this.getItems(t)) : e = this.items, this._getSorters(), this._updateItemsSortData(e)
    }, u.prototype._getSorters = function() {
      var t = this.options.getSortData;
      for (var e in t) {
        var i = t[e];
        this._sorters[e] = p(i)
      }
    }, u.prototype._updateItemsSortData = function(t) {
      for (var e = t && t.length, i = 0; e && e > i; i++) {
        var n = t[i];
        n.updateSortData()
      }
    };
    var p = function() {
      function t(t) {
        if ("string" != typeof t) return t;
        var i = h(t).split(" "),
          n = i[0],
          s = n.match(/^\[(.+)\]$/),
          o = s && s[1],
          r = e(o, n),
          a = u.sortDataParsers[i[1]];
        return t = a ? function(t) { return t && a(r(t)) } : function(t) { return t && r(t) }
      }

      function e(t, e) { var i; return i = t ? function(e) { return e.getAttribute(t) } : function(t) { var i = t.querySelector(e); return i && d(i) } }
      return t
    }();
    u.sortDataParsers = { parseInt: function(t) { return parseInt(t, 10) }, parseFloat: function(t) { return parseFloat(t) } }, u.prototype._sort = function() {
      var t = this.options.sortBy;
      if (t) {
        var e = [].concat.apply(t, this.sortHistory),
          i = a(e, this.options.sortAscending);
        this.filteredItems.sort(i), t != this.sortHistory[0] && this.sortHistory.unshift(t)
      }
    }, u.prototype._mode = function() {
      var t = this.options.layoutMode,
        e = this.modes[t];
      if (!e) throw new Error("No layout mode: " + t);
      return e.options = this.options[t], e
    }, u.prototype._resetLayout = function() { e.prototype._resetLayout.call(this), this._mode()._resetLayout() }, u.prototype._getItemLayoutPosition = function(t) { return this._mode()._getItemLayoutPosition(t) }, u.prototype._manageStamp = function(t) { this._mode()._manageStamp(t) }, u.prototype._getContainerSize = function() { return this._mode()._getContainerSize() }, u.prototype.needsResizeLayout = function() { return this._mode().needsResizeLayout() }, u.prototype.appended = function(t) {
      var e = this.addItems(t);
      if (e.length) {
        var i = this._filterRevealAdded(e);
        this.filteredItems = this.filteredItems.concat(i)
      }
    }, u.prototype.prepended = function(t) {
      var e = this._itemize(t);
      if (e.length) {
        this._resetLayout(), this._manageStamps();
        var i = this._filterRevealAdded(e);
        this.layoutItems(this.filteredItems), this.filteredItems = i.concat(this.filteredItems), this.items = e.concat(this.items)
      }
    }, u.prototype._filterRevealAdded = function(t) { var e = this._filter(t); return this.hide(e.needHide), this.reveal(e.matches), this.layoutItems(e.matches, !0), e.matches }, u.prototype.insert = function(t) {
      var e = this.addItems(t);
      if (e.length) {
        var i, n, s = e.length;
        for (i = 0; s > i; i++) n = e[i], this.element.appendChild(n.element);
        var o = this._filter(e).matches;
        for (i = 0; s > i; i++) e[i].isLayoutInstant = !0;
        for (this.arrange(), i = 0; s > i; i++) delete e[i].isLayoutInstant;
        this.reveal(o)
      }
    };
    var f = u.prototype.remove;
    return u.prototype.remove = function(t) {
      t = s.makeArray(t);
      var e = this.getItems(t);
      f.call(this, t);
      var i = e && e.length;
      if (i)
        for (var n = 0; i > n; n++) {
          var o = e[n];
          s.removeFrom(this.filteredItems, o)
        }
    }, u.prototype.shuffle = function() {
      for (var t = 0, e = this.items.length; e > t; t++) {
        var i = this.items[t];
        i.sortData.random = Math.random()
      }
      this.options.sortBy = "random", this._sort(), this._layout()
    }, u.prototype._noTransition = function(t) {
      var e = this.options.transitionDuration;
      this.options.transitionDuration = 0;
      var i = t.call(this);
      return this.options.transitionDuration = e, i
    }, u.prototype.getFilteredItemElements = function() { for (var t = [], e = 0, i = this.filteredItems.length; i > e; e++) t.push(this.filteredItems[e].element); return t }, u
  }), ! function(t, e) { "function" == typeof define && define.amd ? define("ev-emitter/ev-emitter", e) : "object" == typeof module && module.exports ? module.exports = e() : t.EvEmitter = e() }(this, function() {
    function t() {}
    var e = t.prototype;
    return e.on = function(t, e) {
      if (t && e) {
        var i = this._events = this._events || {},
          n = i[t] = i[t] || [];
        return -1 == n.indexOf(e) && n.push(e), this
      }
    }, e.once = function(t, e) {
      if (t && e) {
        this.on(t, e);
        var i = this._onceEvents = this._onceEvents || {},
          n = i[t] = i[t] || [];
        return n[e] = !0, this
      }
    }, e.off = function(t, e) { var i = this._events && this._events[t]; if (i && i.length) { var n = i.indexOf(e); return -1 != n && i.splice(n, 1), this } }, e.emitEvent = function(t, e) {
      var i = this._events && this._events[t];
      if (i && i.length) {
        var n = 0,
          s = i[n];
        e = e || [];
        for (var o = this._onceEvents && this._onceEvents[t]; s;) {
          var r = o && o[s];
          r && (this.off(t, s), delete o[s]), s.apply(this, e), n += r ? 0 : 1, s = i[n]
        }
        return this
      }
    }, t
  }),
  function(t, e) { "use strict"; "function" == typeof define && define.amd ? define(["ev-emitter/ev-emitter"], function(i) { return e(t, i) }) : "object" == typeof module && module.exports ? module.exports = e(t, require("ev-emitter")) : t.imagesLoaded = e(t, t.EvEmitter) }(window, function(t, e) {
    function i(t, e) { for (var i in e) t[i] = e[i]; return t }

    function n(t) {
      var e = [];
      if (Array.isArray(t)) e = t;
      else if ("number" == typeof t.length)
        for (var i = 0; i < t.length; i++) e.push(t[i]);
      else e.push(t);
      return e
    }

    function s(t, e, o) { return this instanceof s ? ("string" == typeof t && (t = document.querySelectorAll(t)), this.elements = n(t), this.options = i({}, this.options), "function" == typeof e ? o = e : i(this.options, e), o && this.on("always", o), this.getImages(), a && (this.jqDeferred = new a.Deferred), void setTimeout(function() { this.check() }.bind(this))) : new s(t, e, o) }

    function o(t) { this.img = t }

    function r(t, e) { this.url = t, this.element = e, this.img = new Image }
    var a = t.jQuery,
      l = t.console;
    s.prototype = Object.create(e.prototype), s.prototype.options = {}, s.prototype.getImages = function() { this.images = [], this.elements.forEach(this.addElementImages, this) }, s.prototype.addElementImages = function(t) {
      "IMG" == t.nodeName && this.addImage(t), this.options.background === !0 && this.addElementBackgroundImages(t);
      var e = t.nodeType;
      if (e && h[e]) {
        for (var i = t.querySelectorAll("img"), n = 0; n < i.length; n++) {
          var s = i[n];
          this.addImage(s)
        }
        if ("string" == typeof this.options.background) {
          var o = t.querySelectorAll(this.options.background);
          for (n = 0; n < o.length; n++) {
            var r = o[n];
            this.addElementBackgroundImages(r)
          }
        }
      }
    };
    var h = { 1: !0, 9: !0, 11: !0 };
    return s.prototype.addElementBackgroundImages = function(t) {
      var e = getComputedStyle(t);
      if (e)
        for (var i = /url\((['"])?(.*?)\1\)/gi, n = i.exec(e.backgroundImage); null !== n;) {
          var s = n && n[2];
          s && this.addBackground(s, t), n = i.exec(e.backgroundImage)
        }
    }, s.prototype.addImage = function(t) {
      var e = new o(t);
      this.images.push(e)
    }, s.prototype.addBackground = function(t, e) {
      var i = new r(t, e);
      this.images.push(i)
    }, s.prototype.check = function() {
      function t(t, i, n) { setTimeout(function() { e.progress(t, i, n) }) }
      var e = this;
      return this.progressedCount = 0, this.hasAnyBroken = !1, this.images.length ? void this.images.forEach(function(e) { e.once("progress", t), e.check() }) : void this.complete()
    }, s.prototype.progress = function(t, e, i) { this.progressedCount++, this.hasAnyBroken = this.hasAnyBroken || !t.isLoaded, this.emitEvent("progress", [this, t, e]), this.jqDeferred && this.jqDeferred.notify && this.jqDeferred.notify(this, t), this.progressedCount == this.images.length && this.complete(), this.options.debug && l && l.log("progress: " + i, t, e) }, s.prototype.complete = function() {
      var t = this.hasAnyBroken ? "fail" : "done";
      if (this.isComplete = !0, this.emitEvent(t, [this]), this.emitEvent("always", [this]), this.jqDeferred) {
        var e = this.hasAnyBroken ? "reject" : "resolve";
        this.jqDeferred[e](this)
      }
    }, o.prototype = Object.create(e.prototype), o.prototype.check = function() {
      var t = this.getIsImageComplete();
      return t ? void this.confirm(0 !== this.img.naturalWidth, "naturalWidth") : (this.proxyImage = new Image, this.proxyImage.addEventListener("load", this), this.proxyImage.addEventListener("error", this), this.img.addEventListener("load", this), this.img.addEventListener("error", this), void(this.proxyImage.src = this.img.src))
    }, o.prototype.getIsImageComplete = function() { return this.img.complete && void 0 !== this.img.naturalWidth }, o.prototype.confirm = function(t, e) { this.isLoaded = t, this.emitEvent("progress", [this, this.img, e]) }, o.prototype.handleEvent = function(t) {
      var e = "on" + t.type;
      this[e] && this[e](t)
    }, o.prototype.onload = function() { this.confirm(!0, "onload"), this.unbindEvents() }, o.prototype.onerror = function() { this.confirm(!1, "onerror"), this.unbindEvents() }, o.prototype.unbindEvents = function() { this.proxyImage.removeEventListener("load", this), this.proxyImage.removeEventListener("error", this), this.img.removeEventListener("load", this), this.img.removeEventListener("error", this) }, r.prototype = Object.create(o.prototype), r.prototype.check = function() {
      this.img.addEventListener("load", this), this.img.addEventListener("error", this), this.img.src = this.url;
      var t = this.getIsImageComplete();
      t && (this.confirm(0 !== this.img.naturalWidth, "naturalWidth"), this.unbindEvents())
    }, r.prototype.unbindEvents = function() { this.img.removeEventListener("load", this), this.img.removeEventListener("error", this) }, r.prototype.confirm = function(t, e) { this.isLoaded = t, this.emitEvent("progress", [this, this.element, e]) }, s.makeJQueryPlugin = function(e) { e = e || t.jQuery, e && (a = e, a.fn.imagesLoaded = function(t, e) { var i = new s(this, t, e); return i.jqDeferred.promise(a(this)) }) }, s.makeJQueryPlugin(), s
  });