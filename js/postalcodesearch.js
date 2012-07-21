/*
** Author        : Nicolas Bigot
** file format   : utf-8 without BOM (é)
** Last update   : jul 2012
*/

/*
related infos:
http://en.wikipedia.org/wiki/ZIP_code
http://fr.wikipedia.org/wiki/Code_postal_en_France
*/

///////////////////
// string library

lib_string = {

	pattern_accent			: 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýýþÿ',
	pattern_replace_accent	: 'AAAAAAACEEEEIIIIDNOOO0OOUUUUYbsaaaaaaaceeeeiiiidnoooooouuuuyyby',

	toNoAccents: function( text ) {
		var len = text.length;
		for ( var i = 0; i < len; i++ ) {
			var index = this.pattern_accent.indexOf( text[ i ] );
			if ( index != -1 ) {
				text = text.replace( this.pattern_accent.charAt( index ), this.pattern_replace_accent.charAt( index ) );
			}
		}
		return text;
	},

	exactMatch: function( text, searchString ) {
		if ( searchString === '' ) {
			return false;
		}
		var a = this.toNoAccents( text.toLowerCase() );
		var b = this.toNoAccents( searchString.toLowerCase() );
		return ( a.indexOf( b ) !== 0 );
	}
};


///////////////////
// dictionary library

lib_dico = {

	createDictionary: function( depth ) {
		var dic = {};
		dic.info = {};
		dic.info.depth = depth;
		dic.info.minLen = -1;
		dic.info.maxLen = -1;
		dic.info.lengths = [];
		dic.dicData = {};
		return dic;
	},

	insertKeyValue: function( dico, textKey, value ) {

		// update stats
		var len = textKey.length;
		if ( len > dico.info.maxLen || dico.info.maxLen === -1 ) {
			dico.info.maxLen = len;
		}
		if ( len < dico.info.minLen || dico.info.minLen === -1 ) {
			dico.info.minLen = len;
		}
		if ( typeof dico.info.lengths[ len ] === 'undefined' ) {
			dico.info.lengths[ len ] = 1;
		} else {
			dico.info.lengths[ len ] = dico.info.lengths[ len ] + 1;
		}

		// insert into dictionary
		var ptrDico = dico.dicData;
		for ( var i = 0; i < dico.info.depth; i++ )
		{
			if ( len === i ) {
				// string too small for depth
				if ( typeof ptrDico[ "__" ] === 'undefined' ) {
					ptrDico[ "__" ] = [];
				}
				ptrDico = ptrDico[ "__" ];
				break;
			}
			else
			{
				var charAtIndex = textKey[ i ];
				if ( typeof ptrDico[ charAtIndex ] === 'undefined' ) {
					ptrDico[ charAtIndex ] = [];
				}
				ptrDico = ptrDico[ charAtIndex ];
			}
		}

		ptrDico.push( value );
	},

	buildSearchResultsFromTree: function( treeNode, depth, args ) {
		for ( var node in treeNode ) {
			if ( args.cpt >= args.limit ) {
				return;
			} else if ( depth >= args.maxdeep ) {
				var tmpNode = treeNode[ node ];
				if ( typeof args.callbackCmpFunction !== 'undefined' ) {
					if ( args.callbackCmpFunction( args.text, tmpNode ) === 0 ) {
						args.res.push( tmpNode );
						args.cpt = args.cpt + 1;
					}
				} else if ( tmpNode.indexOf( args.text ) === 0 ) {
					args.res.push( tmpNode );
					args.cpt = args.cpt + 1;
				}
			} else if ( node === "__" ) {
				this.buildSearchResultsFromTree( treeNode[ node ], args.maxdeep, args );
			} else if ( typeof treeNode[ node ] === 'object' ) {
				this.buildSearchResultsFromTree( treeNode[ node ], depth+1, args );
			}
		}
	},

	// search inside dictionary
	search: function( text, limit, dicData, depth, callbackCmpFunction ) {
		var len = text.length;
		if ( len <= 0 ) {
			return null;
		}

		var deep = depth;
		if ( len < deep ) {
			deep = len;
		}

		var ptrDico = dicData;
		var deepLevel = 0;
		for ( deepLevel = 0; deepLevel < deep; deepLevel++ ) {
			var charAtIndex = text[ deepLevel ];
			if ( typeof ptrDico[ charAtIndex ] === 'undefined' ) {
				return null;
			}
			ptrDico = ptrDico[ charAtIndex ];
		}

		// build answer
		var args = {};
		args.text = text;
		args.limit = limit;
		args.cpt = 0;
		args.res = [];
		args.currentNode = ptrDico;
		args.maxdeep = depth;
		args.callbackCmpFunction = callbackCmpFunction;
		this.buildSearchResultsFromTree( ptrDico, deepLevel, args );

		return args.res;
	}
}


///////////////////
//  postal codes / ZIP codes database

/*
 The database is just a simple javascript varaible which contains a huge array of postal codes.
 You can include a javascript file that contains this variable (for example you can name it zipcodes.js)
 With this way of doing there is NO asynchronous ajax call to a web service because of those reasons:
 - a simple javascript file is complient with offline browsing webapp
 - it's easier to maintain code / no need to check web service is up
 - it's server friendly (no CPU waste and no webservice to call each time the user press a key)
 - yes it's consuming a lot of bandwidth but you can use cache and manifest to
 keep it localy for a long time, and you can put the file on a CDN within a cookieless domain
 
 note: my need was only for french postal codes so I didn't wrote code for US ZIP
 but I guess you can esealy add it. (you can for exampel remove FR_* and write the code for US_ZIP).
*/

lib_postalCodesDB = {

	FR_commune: {
		initialized: false,
		db: null,
		dic: null,
		dic2: null,
		
		init: function() {
			// init postal codes
			if ( this.initialized ) {
				return;
			} else {
				this.initialized = true;
			}

			this.db = cp_fr.communes,	// link to external javascript variable
			this.dic = lib_dico.createDictionary( 3 );
			this.dic2 = lib_dico.createDictionary( 3 );

			$.each( this.db, function( index, data ) {
				var nameLowerCase = lib_string.toNoAccents( data[ 1 ] ).toLowerCase();
				data[ 8 ] = nameLowerCase;
				lib_dico.insertKeyValue( lib_postalCodesDB.FR_commune.dic, nameLowerCase, data );
				lib_dico.insertKeyValue( lib_postalCodesDB.FR_commune.dic2, data[ 3 ], data );
			});
		}
	},
	FR_departement: {
		initialized: false,
		db: null,
		dic: null,
		dic2: null,
		
		init: function() {
			// init departements
			if ( this.initialized ) {
				return;
			} else {
				this.initialized = true;
			}
			
			this.db = cp_fr.departements,	// link to external javascript variable
			this.dic = lib_dico.createDictionary( 2 );
			this.dic2 = lib_dico.createDictionary( 2 );
			
			$.each( this.db, function( codeDepartement, data ) {
				var strDepartement = data[ 0 ];
				var nameLowerCase = lib_string.toNoAccents( strDepartement ).toLowerCase();
				var codeDepartementLowerCase = codeDepartement.toLowerCase();
				var value = [ nameLowerCase, codeDepartement, strDepartement, data[ 1 ], codeDepartementLowerCase ];
				lib_dico.insertKeyValue( lib_postalCodesDB.FR_departement.dic, nameLowerCase, value );
				lib_dico.insertKeyValue( lib_postalCodesDB.FR_departement.dic2, codeDepartementLowerCase, value );
			});
		}
	},
	FR_region: {
		initialized: false,
		db: null,
		dic: null,
		
		init: function() {
			// init regions
			if ( this.initialized ) {
				return;
			} else {
				this.initialized = true;
			}

			this.db = cp_fr.regions,	// link to external javascript variable
			this.dic = lib_dico.createDictionary( 2 );

			$.each( this.db, function( codeRegion, strRegion ) {
				var nameLowerCase = lib_string.toNoAccents( strRegion ).toLowerCase();
				var value = [ nameLowerCase, strRegion, codeRegion ];
				lib_dico.insertKeyValue( lib_postalCodesDB.FR_region.dic, nameLowerCase, value );
			});
		}
	},
	US_ZIP: {
		initialized: false,
		db: null,
		dic: null,
		
		init: function() {
			if ( this.initialized ) {
				return;
			} else {
				this.initialized = true;
			}
			
			/* TODO: put your code for US ZIP codes here */
		}
	},
	init: function() {
		this.FR_commune.init();
		this.FR_departement.init();
		this.FR_region.init();
		this.US_ZIP.init();
	}
};


///////////////////
// page dialog search location

lib_postalCodeSearch = {
options: {
	initialized : false
},
customSearch: {
	FR_commune: {
		maxItemsListDisplay	: 20,
		formatDataFunction	: function ( data ) { return '<li data-filtertext="' + data[ 8 ] + '"><a internalIndex="' + data[ 0 ] + '">' + data[ 1 ] + ' (' + data[ 3 ] + ')</a></li>'; },
		callbackCmpFunction : function( text, data ) {
			var nameLowerCase = data[ 8 ];
			return nameLowerCase.indexOf( text );
		},		
		callbackSortFunction : function( a, b ) {
			// search by name
			return a[ 8 ].localeCompare( b[ 8 ] );
		},
		callbackCmpFunction2 : function( text, data ) {
			// search by code
			var nameLowerCase = data[ 3 ];
			return nameLowerCase.indexOf( text );
		},
		callbackSearchFunction : function( text, limit ) {
			if ( lib_postalCodesDB.FR_commune.initialized !== true ) {
				return null;
			}
			var findText = lib_string.toNoAccents( text ).toLowerCase();
			var result;
			if ( isNaN( parseInt( findText[ 0 ] ) ) ) {
				result = lib_dico.search( findText, limit, lib_postalCodesDB.FR_commune.dic.dicData, lib_postalCodesDB.FR_commune.dic.info.depth, this.callbackCmpFunction );
			} else {
				result = lib_dico.search( findText, limit, lib_postalCodesDB.FR_commune.dic2.dicData, lib_postalCodesDB.FR_commune.dic2.info.depth, this.callbackCmpFunction2 );
			}
			if ( result != null ) {
				result.sort( this.callbackSortFunction );
			}
			return result;
		},
		init: function() {
			lib_postalCodesDB.FR_commune.init();
		}
	},
	FR_departement: {
		maxItemsListDisplay	: 10,
		formatDataFunction	: function ( data ) { return '<li data-filtertext="' + data[0] + '"><a internalIndex="' + data[3] + '">' + data[2] + ' (' + data[1] + ')</a></li>'; },
		callbackCmpFunction : function( text, data ) {
			var nameLowerCase = data[ 0 ];
			return nameLowerCase.indexOf( text );
		},
		callbackSortFunction : function( a, b ) {
			// search by name
			return a[ 0 ].localeCompare( b[ 0 ] );
		},
		callbackCmpFunction2 : function( text, data ) {
			// search by code
			return data[ 4 ].indexOf( text );
		},
		callbackSearchFunction : function( text, limit ) {
			if ( lib_postalCodesDB.FR_departement.initialized !== true ) {
				return null;
			}
			var findText = lib_string.toNoAccents( text ).toLowerCase();
			var result;
			if ( isNaN( parseInt( findText[ 0 ]) ) ) {
				result = lib_dico.search( findText, limit, lib_postalCodesDB.FR_departement.dic.dicData, lib_postalCodesDB.FR_departement.dic.info.depth, this.callbackCmpFunction );
			} else {
				result = lib_dico.search( findText, limit, lib_postalCodesDB.FR_departement.dic2.dicData, lib_postalCodesDB.FR_departement.dic2.info.depth, this.callbackCmpFunction2 );
			}
			if ( result != null ) {
				result.sort( this.callbackSortFunction );
			}
			return result;
		},
		init: function() {
			lib_postalCodesDB.FR_departement.init();
		}
	},
	FR_region: {
		maxItemsListDisplay	: 10,
		formatDataFunction	: function ( data ) { return '<li data-filtertext="' + data[0] + '"><a internalIndex="' + data[2] + '">' + data[1] + ' (' + data[2] + ')</a></li>'; },
		callbackCmpFunction : function( text, data ) {
			var nameLowerCase = data[ 0 ];
			return nameLowerCase.indexOf( text );
		},
		callbackSortFunction : function( a, b ) {
			return a[ 0 ].localeCompare( b[ 0 ] );
		},
		callbackSearchFunction : function( text, limit ) {
			if ( lib_postalCodesDB.FR_region.initialized !== true ) {
				return null;
			}
			var findText = lib_string.toNoAccents( text ).toLowerCase();
			var result = lib_dico.search( findText, limit, lib_postalCodesDB.FR_region.dic.dicData, lib_postalCodesDB.FR_region.dic.info.depth, this.callbackCmpFunction );
			if ( result != null ) {
				result.sort( this.callbackSortFunction );
			}
			return result;
		},
		init: function() {
			lib_postalCodesDB.FR_region.init();
		}
	},
	US_ZIP: {
		/* TODO */
	}
},

alwaysMatch: function( text, searchString ) {
	return false;	// don't hide, accept all
},

onClickItem: function( event ) {

	event.stopImmediatePropagation();
	event.preventDefault();

	// compute results
	var dataResult = {
		text: event.target.text,
		internalIndex: $( event.target ).attr( "internalIndex" ),
		areatype: event.data.customSearchType
	};
	
	console.log( dataResult );

	// close all search results area lists
	$( "a.ui-input-clear" ).click();
},

fillListItems: function( listviewObj, searchText ) {

	var customSearchType = listviewObj.listview( 'option', 'customSearchType' );
	
	listviewObj.children().remove();

	if ( typeof searchText === 'undefined' || searchText === null || searchText == '' ) {
		listviewObj.listview( "refresh" );
	} else {
		// build list of items
		var options = lib_postalCodeSearch.customSearch[ customSearchType ];
		var data = options.callbackSearchFunction( searchText, options.maxItemsListDisplay );
		if ( ( typeof data !== 'undefined' ) && ( data != null ) ) {
			var list = "";
			var cpt = 0;
			for ( var index in data ) {
				list += options.formatDataFunction( data[ index ] );
				cpt++;
				if ( cpt >= options.maxItemsListDisplay ) {
					break;
				}
			}

			// refresh viewlist
			listviewObj.append( list ).listview( "refresh" );
		} else {
			listviewObj.listview( "refresh" );
		}
	}
},

/* needs the modified version of jquery.mobile-1.0_edited.js */
onKeyUpCallback: function( inputObj, listviewObj ) {
	inputObj.jqmData( "lastval" , "" );	// little hack
	var searchText = lib_string.toNoAccents( inputObj.val() ).toLowerCase();
	lib_postalCodeSearch.fillListItems( listviewObj, searchText );
},

initCustomSearchType: function( listviewSelector, customSearchType ) {

	this.customSearch[ customSearchType ].init();
	var listviewObj = $( listviewSelector ).listview();
	listviewObj.listview( 'option', 'filterCallback', this.alwaysMatch );
	listviewObj.listview( 'option', 'onKeyUpCallback', this.onKeyUpCallback );
	listviewObj.listview( 'option', 'customSearchType', customSearchType );
	this.fillListItems( listviewObj, null );

	$( listviewObj ).on( 'vclick', 'li', { listviewObj: listviewObj, customSearchType: customSearchType }, this.onClickItem );
},

pageinit: function() {

	if ( this.options.initialized ) {
		return;
	}
	this.options.initialized = true;
	
	// asynchronous load postal codes database
	$.ajax({
		url: "js/fr_postal_codes.js",
		async: true,
		cache: true,
		contentType: "charset=utf-8",
		dataType: "text",
		success: function( script, textStatus, jqXHR ) {
			// the loaded file is a javascript document which contains
			// the database of zip/postal codes
			// perform an eval on it to access it's variables by javascript
			$.globalEval( script );
			// init the components
			lib_postalCodeSearch.onpageloadedfirsttime();
		}
	});
},

onpageloadedfirsttime: function() {
	lib_postalCodesDB.init();
	$( '#search_commune ul' ).listview();
	$( '#search_dep ul' ).listview();
	$( '#search_region ul' ).listview();
	$( '#search_ZIP ul' ).listview();
	this.initCustomSearchType( "#search_commune ul:jqmData(role='listview')", 'FR_commune' );
	this.initCustomSearchType( "#search_dep ul:jqmData(role='listview')", 'FR_departement' );
	this.initCustomSearchType( "#search_region ul:jqmData(role='listview')", 'FR_region' );
	/*this.initCustomSearchType( "#search_ZIP ul:jqmData(role='listview')", 'US_ZIP' );*/
}

};


///////////////////
// on document start

$(document).bind("mobileinit", function() {
	lib_postalCodeSearch.pageinit();
	/*lib_postalCodeSearch.onpageloadedfirsttime();*/
});
