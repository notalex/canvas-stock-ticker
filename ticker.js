// <![CDATA[
	// The number of seconds we would like for it to take for the entire
	// message to be scrolled across the ticker.
	var PS_SCROLL_TIME		= 30;
	// Comma separated list of ticker symbols
	var PS_TICKER_SYMBOLS	= "ORCL,AAPL,MSFT";
	var PS_BACKGROUND_COLOR	= "black";
	var PS_TEXT_COLOR			= "green";
	// These two values are supplied by automatically by the server
	var __widget_width		= 280;
	var __widget_height		= 40;
// ]]>
// <![CDATA[
	var html             = document.getElementsByTagName("html")[0];
	var canvas           = document.getElementById('ticker');
	var context          = canvas.getContext("2d");

	var cachedTickers    = null;
	var message          = "";
	var textWidth        = 0;
	var pixelsPerSecond  = 0;

	var textPosition     = 0;
	var lastDrawTime     = 0;

	canvas.width = __widget_width;
	canvas.height = __widget_height;
	canvas.style.backgroundColor = PS_BACKGROUND_COLOR;

	context.font = "bold "+(canvas.height/2)+"px sans-serif";
	context.fillStyle = PS_TEXT_COLOR;
	context.textAlign = "left";
	context.textBaseline = "middle";

	function animate() {
		var currTime	= new Date().getTime();
		var elapsed		= currTime - lastDrawTime;

		// Move the text over to the left based on how many milliseconds have
		// elapsed since the last time the ticker was drawn. This is the key to
		// smooth, consistent animation.
		textPosition -= (pixelsPerSecond * (0.001 * elapsed));

		// Erase the entire ticker so we can redraw the text at the new position
		context.clearRect(0,0,canvas.width,canvas.height);

		// Draw the message at the current position
		context.fillText(message,textPosition,canvas.height/2);

		// How we achieve the wrap-around effect depends on the size of the
		// message (whether it's narrower or wider than the canvas).
		if(textWidth < canvas.width)
		{
			// Since the message is narrower than the canvas width, we wait until
			// the message has started to scroll off the left edge of the canvas.
			// Then we draw the missing part at the right edge of the canvas.
			if(textPosition < 0)
				context.fillText(message,textPosition+canvas.width,canvas.height/2);

			// If the message has completely scrolled off the left, move the
			// text position back to the right. Now's a good time to schedule
			// an update of the quote values, too.
			if(textPosition < -textWidth)
			{
				textPosition = textPosition+canvas.width;
				setTimeout(getQuotes,1000);
			}
		}
		else
		{
			// Since the message is wider than the canvas width, we check to see
			// if the visible portion of what we just drew was large enough to
			// fill the width of the canvas. If it wasn't, we draw the message a
			// second time where the first one ended.
			if((textPosition + textWidth) < canvas.width)
				context.fillText(message,textPosition+textWidth,canvas.height/2);

			// If the current text position is so far off to the left that nothing
			// will be visible, move the position back to the right
			if(textPosition < -textWidth)
			{
				textPosition += textWidth;
				setTimeout(getQuotes,1000);
			}
		}

		lastDrawTime = currTime;
	}

	function setMessage(newMessage) {
		// Add a space at the end so it looks good when the message is wrapped
		message = newMessage + " ";

		// Calculate the width, in pixels, of the message
		textWidth = context.measureText(message).width;

		// Calculate how many pixels we need to scroll the message each second
		// in order for it to be displayed within PS_SCROLL_TIME. This is handled
		// differently depending on whether the message is shorter or longer than
		// the canvas
		pixelsPerSecond = Math.max(canvas.width,textWidth) / PS_SCROLL_TIME;

		// Start the animation loop if it hasn't been already
		if(lastDrawTime == 0) {
			// Start displaying at the very right of the ticker
			textPosition = canvas.width;

			// Set the last draw time to now
			lastDrawTime = new Date().getTime();

			// Tell the browser to call the animation function every 33
			// milliseconds (which is about 30 times per second)
			setInterval(animate,33);
		}
	}

	/**
	 * In order to get quotes from Yahoo! Finance using YQL, we have to wrap
	 * each ticker symbol in quotes.
	 */
	function parseTickerSymbols() {
		var index0 = 0;	// the current search position
		var index1 = 0;	// the current match position
		var symbol = "";

		cachedTickers = "";

		while(index0 < PS_TICKER_SYMBOLS.length)
		{
			// Find the next comma starting from the current search position
			index1 = PS_TICKER_SYMBOLS.indexOf(",",index0);

			// If indexOf() returns -1, there are no more commmas left to find
			if(index1 == -1)
				index1 = PS_TICKER_SYMBOLS.length;

			// Append commas after each item
			if(cachedTickers.length != 0)
				cachedTickers += ",";

			// Extract only the ticker symbol
			symbol = PS_TICKER_SYMBOLS.substr(index0,(index1-index0));
			// Trim whitespace
			symbol = symbol.replace(/^\s+|\s+$/g,'');

			// Wrap the symbol in quotes and append it to the query
			cachedTickers += '"';
			cachedTickers += symbol;
			cachedTickers += '"';

			// Move the current search position to right
			// after where we found the last comma
			index0 = index1 + 1;
		}

		// HTTP escape the quotes and commas (i.e., replace quotes with %22 and
		// commas with %2C)
		cachedTickers = escape(cachedTickers);
	}

	// This method generates a Yahoo Query Language query of yahoo.finance.quotes
	// using the user supplied ticker symbols. The result is returned as JSONP,
	// the callback function is quotesAvailable().
	//
	// Vist http://developer.yahoo.com/yql/ for more information about YQL
	function getQuotes() {
		var query
			= "http://query.yahooapis.com/v1/public/yql?q=select%20symbol"
			+ "%2CLastTradePriceOnly%2CChange%2CVolume%20from%20"
			+ "yahoo.finance.quotes%20where%20symbol%20in%20(";

		if(cachedTickers == null)
			parseTickerSymbols();

		query += cachedTickers;
		query += ")&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org";
		query += "%2Falltableswithkeys&callback=quotesAvailable";

		// Yahoo's YQL servers enable cross-site requests by returning
		// the "Access-Control-Allow-Origin" HTTP header with a value of "*".
		// Thus we can use ordinary AJAX to poll for new data.
		// Otherwise we'd have to use another approach (such as creating a SCRIPT
		// tag and setting its src to the query every time)
		var request = new XMLHttpRequest();
		request.open("GET",query,true);
		request.onreadystatechange = function() {
			if(request.readyState == 4)
				eval(request.responseText);
		};
		request.send();
	}

	// This function is called whenever quote information has been returned by
	// Yahoo!'s server.
	function quotesAvailable(response) {
		var newMessage = "";
		var quotes;

		if(!response.query
		|| !response.query.results
		|| !response.query.results.quote)
			return;

		quotes = response.query.results.quote;

		// Add each symbol and quote information to the new message
		for(var i=0;i<quotes.length;i++)
		{
			if(!quotes[i].symbol || !quotes[i].LastTradePriceOnly)
				continue;

			newMessage += " " + quotes[i].symbol;
			newMessage += " " + quotes[i].LastTradePriceOnly;

			if(quotes[i].Change)
				newMessage += " " + quotes[i].Change;

			// Beautify the volumes by converting them to thousands, millions or
			// billions
			if(quotes[i].Volume)
			{
				volume = parseInt(quotes[i].Volume);

				if(volume < 1000)
					newMessage += " " + volume;
				else if(volume < 1000000)
					newMessage += " " + Math.round(volume/1000) + "K";
				else if(volume < 1000000000)
					newMessage += " " + Math.round(volume/1000000) + "M";
				else
					newMessage += " " + Math.round(volume/1000000000) + "B";
			}
		}

		setMessage(newMessage);
	}

	setMessage("PHYSICS SYSTEMS");
	setTimeout(getQuotes,1000);
// ]]>
