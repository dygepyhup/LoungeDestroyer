// Navigation variables
var navAnchor	= $('nav[role="navigation"] ul a');
var navList 	= $('nav[role="navigation"] ul li');
var navEnabled	= true;
var $pages = $('section[id*="page-"]');

// -----------------------------------------
// Add class 'active' to currently visible page
// -----------------------------------------

navAnchor.each( function() {
	// Variables
	var self 		= $(this);
	var parent 		= self.parent();
	var currentPage = $('section:visible').attr('id');

	// Remove every 'active' class
	parent.removeClass('active');
	
	// Add class 'active' to currently visible page's anchor
	if (self.attr('href').replace('#','') == currentPage)
		parent.not('.logo').addClass('active');
});

var changelogRequested = false;
var patreonsRequested = false;
var bettableListInitiated = false;

var currencies = {};

// -----------------------------------------
// Page switcher
// -----------------------------------------

navAnchor.click( function(e) {
	// Disable link
	e.preventDefault();

	if (navEnabled) {
		// Variables
		var self 			= $(this);
		var page 			= self.attr('href').replace('#','');
		
		// Add class 'active' for active page
		if (!self.parent().hasClass('active')) {
			navList.removeClass('active');
			navList.find('a[href*="#' + page + '"]').parent().not('.logo').addClass('active');

			// // Show / hide needed content
			$('section:visible').addClass('hidden');
			$('section#' + page).removeClass('hidden');

			// Clearing out text fields on page switch
            // FIXME: http://i.imgur.com/fbGCaA3.png

            //$('input, textarea').not('.btn').val('');

			// Removing class 'group-error' on page switch
			$('div.group-error').removeClass('group-error');
		}
	}

	if(page === 'page-changelog') {
		var $changelog = $('#page-changelog .pad-full');
		var $changelogContent = $('#changelog-content');

		if(!changelogRequested) {
            changelogRequested = true;

            $('.preloader.loading', $changelog).show();
			$.ajax('https://api.github.com/repos/ncla/LoungeDestroyer/releases?per_page=15', {
				type: 'GET',
				dataType: 'json',
				success: function(data) {
					$.each(data, function(i, release) {
						var releaseVersion = release.tag_name;
						var releaseDate = moment(release.published_at).format('MMMM Do, YYYY').toLowerCase();
						var $releaseName = $('<h3></h3>');
						$releaseName.text(releaseVersion);
						$releaseName.append(' <small>released on ' + releaseDate + '</small>');

						$changelogContent.append($releaseName);
						$changelogContent.append(DOMPurify.sanitize(marked(release.body)));
						$changelogContent.append('<br class="margin"/>');
					});
					$changelogContent.find('ul').addClass('list');
					$('.preloader.loading', $changelog).fadeOut(function() {
						$changelogContent.fadeIn();
					});
				},
				error: function(jqXHR) {
					$('.preloader.loading', $changelog).fadeOut(function() {
						$changelogContent.fadeIn();
					});
					$changelogContent.append('<p>Failed to load changelog.. :(</p>');
				}
			});
		}
	}

	if(page === 'page-bettableitems') {
		if(!bettableListInitiated) {
			var $betItems = $('#page-bettableitems .pad-full');
			var $betItemsContent = $('#bettable-items-content');
            var $tableBody = document.getElementById('bet-list-tbody');

            bettableListInitiated = true;

            chrome.storage.local.get(['marketPriceList', 'currencyConversionRates'], function(result) {
                var pricelist = result.marketPriceList || {};
                currencies = result.currencyConversionRates || {};
                var csgoPricelist = pricelist['730'] || {};

                $('.preloader.loading', $betItems).show();

                $.ajax('http://csgolounge.com/api/schema.php', {
                    type: 'GET',
                    dataType: 'text',
                    success: function(data) {
                        console.time('Parsing CSGL item list');

                        // Sometimes the response is `false` and obviously that isn't JSON parsable
                        try {
                            data = $.parseJSON(data);
                        } catch (e) {
                            console.error(e);

                            $('.preloader.loading', $betItems).fadeOut(function() {
                                $('.error-loading-bet-list').fadeIn();
                            });

                            data = false;
                        }

                        if (data === false) {
                            return;
                        }


                        var htmlToAppend = '';

                        $.each(data, function(i, v) {
                            var floatValue = parseFloat(v.worth);

                            if(floatValue > 0) {
                                var marketPriceStr = '-';
                                var diffStr = '-';
                                var overpriceStr = '-';
								var bettingValStr = convertPrice(floatValue, true);

                                var item = new Item();
                                item.itemName = v.name;

                                if (csgoPricelist.hasOwnProperty(v.name)) {
									item.loungeValue = floatValue;
									item.marketValue = (csgoPricelist[v.name].hasOwnProperty('value') ? csgoPricelist[v.name]['value'] : csgoPricelist[v.name]);

                                    marketPriceStr = convertPrice(item.marketValue, true);

                                    item.calculateMarketDifference().calculateMarketOverprice();

                                    diffStr = (item.marketDifference ? convertPrice(item.marketDifference, true) : '-');
                                    overpriceStr = (item.marketOverprice ? item.marketOverprice + '%' : '-');
                                }

                                var steamUrl = item.generateMarketURL(730);
                                var opskinsUrl = item.generateOPSkinsURL(730);
                                var bitskinsUrl = item.generateBitskinsURL();

                                htmlToAppend += '<tr><th scope="row">' + removeTags(v.name) + '</th><td>' + bettingValStr + '</td> <td>' + marketPriceStr + '</td>' +
                                    '<td data-diff="' + (item.marketDifference || 0) + '">'+diffStr+'</td> <td data-op="'+(item.marketOverprice || 100)+'">'+overpriceStr+'</td> <td><a href="' + steamUrl + '" target="_blank">STEAM</a></td>' +
                                    '<td><a href="' + opskinsUrl + '" target="_blank">OPSKINS</a></td> <td><a href="' + bitskinsUrl + '" target="_blank">BITSKINS</a></td></tr>';

                            }
                        });
                        console.timeEnd('Parsing CSGL item list');

                        console.time('Appending table into DOM');
                        $tableBody.innerHTML += htmlToAppend;
                        console.timeEnd('Appending table into DOM');

                        console.time('Tablesort initiated');
						$table = $('#bettable-items-content table');

                        $.tablesorter.addParser({
                            id: 'data',
                            is: function(s, table, cell, $cell) {
                                // return false so this parser is not auto detected
                                return false;
                            },
                            format: function(s, table, cell, cellIndex) {
                                var $cell = $(cell);

                                if (cellIndex === 3) {
                                    return $cell.attr('data-diff') || s;
                                }

                                if (cellIndex === 4) {
                                    return $cell.attr('data-op') || s;
                                }

                                return s;
                            },
                            parsed: false,
                            type: 'numeric'
                        });

                        $table.tablesorter({
                            showProcessing: true,
							cssProcessing: 'table-sorting-loading',
                            headers: {
                                3: {sorter: 'data'},
                                4: {sorter: 'data'},
                                5: {sorter: false},
                                6: {sorter: false},
                                7: {sorter: false}
                            },
                            emptyTo: 'bottom'
                        }).bind('sortBegin sortEnd', function(event, table) {
							$.tablesorter.isProcessing( this, event.type === 'sortBegin' );
						});

                        console.timeEnd('Tablesort initiated');

                        $('.preloader.loading', $betItems).fadeOut(function() {
                            $betItemsContent.fadeIn();
                        });
                    },
                    error: function(jqXHR) {
                        $('.preloader.loading', $betItems).fadeOut(function() {
                            $('.error-loading-bet-list').fadeIn();
                        });
                    },
                    cache: false
                });
            });
		}
	}

	if(page === 'page-themes') {
		initSlider();
	}
});

// -----------------------------------------
// Tooltips
// -----------------------------------------

$('[data-tooltip]').each( function(e) {
	// Variables
	var self 		= $(this);
	var content 	= self.data('tooltip');
	var tooltip 	= $('<div class="tooltip">' + content + '</div>').appendTo('body');

	// Show tooltip on hover
	self.hover( function() {
		var position 	= self.offset();
		var css 		= {
			top: 		Math.round(position.top + self.height()),
			left: 		Math.round(position.left - (tooltip.outerWidth() / 2 - 11))
		};

		// Positioning tooltip
		tooltip.css(css);

		// Show / hide tooltip
		tooltip.toggleClass('show');
	});
});

// -----------------------------------------
// Adding padding to the right for inline forms
// -----------------------------------------

$('form.form-inline').each( function() {
	// Variables
	var self 	= $(this);
	var button 	= self.find('.btn');
	var input 	= self.find('input').not('.btn');

	// Adding padding
	input.css({
		paddingRight: button.outerWidth() + 12
	});
});

// -----------------------------------------
// Input validation
// -----------------------------------------
 
function validateInput($elm, callback, ignoreEmpty) {
	var value	 = $elm.val();
	var classTarget = getClassTarget();

	// fail if no value is entered
	// or succeed if empty and should ignore empty
	if (!$elm.val().length) {
		if (ignoreEmpty) { return succeed(); }
		else { return fail(); }
	}

	// fail if this specific type doesn't validate
	var type = $elm.data("validation");
	if (validators.hasOwnProperty(type)) {
		// if validator is synchronous
		if (["url", "number"].indexOf(type) !== -1) {
			var result = validators[type](value);
			if (result) { return succeed(); }
			return fail();
		}

		// if not synchronous
		validators[type](value,  function(result){
			if (result) { return succeed(); }
			return fail();
		});
	}

	// helper functions
	function fail() {
		classTarget.addClass("group-error");
		$elm[0].valid = false;
		callback(false);
	}
	function succeed() {
		classTarget.removeClass("group-error");
		$elm[0].valid = true;
		callback(true);
	}
	function getClassTarget() {
		if ($elm.parent().hasClass("row")) {
			return $elm.parent().parent();
		}
		return $elm.parent();
	}
};
 
// VALIDATORS
var validators = {
	// Validates a URL
	url:  function(str) {
		var urlRegexp = /^(http(?:s)?\:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,6}(?:\/?|(?:\/[\w\-]+)*)(?:\/?|\/\w+\.[a-zA-Z]{2,4}(?:\?[\w]+\=[\w\-]+)?)?(?:\&[\w]+\=[\w\-]+)*(?:\.([a-zA-Z0-9]+))?)$/i;
		return urlRegexp.test(str);
	},

	// Validates a number
	number:  function(str) {
		return !isNaN(parseInt(str));
	}
};
 
// Validate inputs when their data is changed
$("input[data-validation]")
	.on("input",  function(){
		var self = this;
		// if it's currently at an error, validate instantly
		if (self.valid === false) {
			clearTimeout(self.validateTimer);
			validateInput($(self),  function(){}, true);
			return;
		}

		// otherwise, wait until the user hasn't typed for 1 sec
		clearTimeout(self.validateTimer);
		self.validateTimer = setTimeout( function(){
			validateInput($(self),  function(){}, true);
		}, 1000);
	})
	// or when they lose focus
	.blur( function(){
		var self = this;
		clearTimeout(self.validateTimer);
		validateInput($(self),  function(){}, true);
	}
);
 
// Verify forms
$('form').each( function() {
	// Variables
	var form		= $(this);
	var submit		= form.find('input[type="submit"]');

	submit.click( function(e) {
		e.preventDefault();

		// Variables
		var self		= $(this);
		var fields		= form.find('input[data-validation], input[data-required], textarea[data-required]').not('.btn');
		var allFields 	= form.find('input, textarea').not('.btn');
		var valid 		= true;

		// create a function that continues when it's called the nth time
		var fieldValid =  function(result){
			var self = fieldValid;
			++self.curNum;

			// If a field failed to validate
			if (!result) {
				self =  function(){};
				return;
			}

			// do a certain action once every field has been validated
			if (self.curNum === self.targetNum) {
				allFields.val("");
			}
		};

		fieldValid.curNum = 0;
		fieldValid.targetNum = fields.length;

		// validate all fields
		fields.each( function() {
			var $self = $(this);
			// if it has validation, and is non-empty/should be non-empty
			if ($self.data("validation") && (typeof $self.data("required") !== "undefined" || $self.val().length)) {
				validateInput($self, fieldValid);
			// else if it has no validation, but is required
			} else if (typeof $self.data("required") !== "undefined") {
				fieldValid(!!$self.val().length);
			// if it has validation, but is non-empty (and allowed to be)
			} else {
				fieldValid(true);
			}
		});
	});
});

// -----------------------------------------
// Enabling only allowed characters to be inputted in text fields
// -----------------------------------------

$('input[data-validation="number"]').keypress( function(e) {
	// Allowed keycodes: 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57 (. and 0-9)
	if (!(e.keyCode == 46 || (e.keyCode >= 48 && e.keyCode <= 57)))
		e.preventDefault();
});

// -----------------------------------------
// Handy functions
// -----------------------------------------

function disableBtn(element, loading, loadingText) {
	// Variables
	var self 		= $(element);
	var loading		= loading ? loading : false;
	var loadingText	= loadingText ? loadingText : 'Loading...';

	// Add class 'btn-loading', if needed
	if (loading) {
		self.addClass('btn-loading');
		self.attr('data-loading', loadingText);
	}

	self.attr('disabled', 'disabled');
}

// -----------------------------------------
// Theme slider
// -----------------------------------------
var $themeSlider 		= $('#themes-slider');
var sliderNavsEnabled 	= true;
var cssEditorVisible 	= false;
var $cssEditor, $cssSave;

function initSlider() {
    $themeSlider.each( function() {
        // Variables
        var self			= $(this);
        var $allSettings 	= self.find('div.theme-settings');
        var $preview 		= self.find('div.theme-preview');
        var $slides 		= self.find('li[data-theme]');

        // Aligning settings box in the middle of the preview area
        $allSettings.each(function() {
            var $settings 	= $(this);
            var top 		= ($preview.height() - $settings.outerHeight()) / 2;
            var left 		= ($preview.width() - $settings.outerWidth()) / 2;

            $settings.css({
                top: top,
                left: left
            });
        });

        $themeSlider.addClass('slider-loaded');
		//$pages.addClass('hidden').first().removeClass('hidden');

        if(self.find('li[data-theme].active').length) {
            self.find('li[data-theme].active').addClass('current');
        } else {
            $slides.eq(0).addClass('current');
        }

        // Carousel
        var currSlide 	= $slides.index($('.current')) + 1;
        var allSlides	= $slides.length;
        var $prev		= self.find('li.prev');
        var $next		= self.find('li.next');

        // Hide navs, if there are not enough slides
        if (allSlides < 2) {
            $themeSlider.addClass('slider-hide-navs');
            sliderNavsEnabled = false;
        } else {
            $themeSlider.removeClass('slider-hide-navs');
        }

        if (sliderNavsEnabled) {
            // Switch to previous slide by clicking on the arrow "left"
            $prev.click(function() {
                prevSlide();
            });

            // Switch to next slide by clicking on the arrow "right"
            $next.click(function() {
                nextSlide();
            });

            // Switch between slides by using "left" / "right" arrow keys
            $('body').keydown(function(e) {
                if (e.keyCode == 37)
                    prevSlide();
                else if (e.keyCode == 39)
                    nextSlide();
            });
        }

        // Previous slide function
        function prevSlide() {
            $slides.removeClass('current');

            if (currSlide == 1) {
                currSlide = allSlides;

                $slides.last('li[data-theme]').addClass('current');
            } else {
                currSlide--;

                $slides.eq(currSlide - 1).addClass('current');
            }
        }

        // Next slide function
        function nextSlide() {
            $slides.removeClass('current');

            if (currSlide == allSlides) {
                currSlide = 1;

                $slides.first('li[data-theme]').addClass('current');
            } else {
                currSlide++;

                $slides.eq(currSlide - 1).addClass('current');
            }
        }
    });
}

$('button.btn[data-theme-action]').click( function() {
	var self = $(this);
	var data = self.data('theme-action');
	var current = $('li[data-theme].current');

	if (data == 'edit') {
		cssEditorVisible 	= true;
		$cssEditor 			= current.find('.css-edit');
		$cssSave 			= current.find('.btn-save');

		$cssEditor.addClass('css-edit-show');
		$cssSave.addClass('btn-save-show');

		setTimeout(function() {
			current.find('textarea').focus();
		}, 320);
	} else if (data == 'delete') {
		//alert('');
	}
});

$('button.btn[data-theme-settings]').click( function() {
	var self 	= $(this);
	var data 	= self.data('theme-settings');

	$themeSlider.each( function() {
		var self 	= $(this);
		var $preview = self.find('li.current div.theme-preview');

		if (data == 'open') {
			if (sliderNavsEnabled)
				self.addClass('slider-hide-navs');

			$preview.addClass('theme-settings-open');
		} else if (data == 'close') {
			if (sliderNavsEnabled)
				self.removeClass('slider-hide-navs');

			$preview.removeClass('theme-settings-open');

			if (cssEditorVisible) {
				$cssEditor.removeClass('css-edit-show');
				$cssSave.removeClass('btn-save-show');
			}
		}
	});
});
