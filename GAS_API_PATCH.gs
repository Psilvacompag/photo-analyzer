// ==========================================
// API ENDPOINTS (agregar a tu PhotoAnalyzer.gs existente)
// ==========================================
// Reemplazá tu doGet actual por este:

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  
  // Si no hay action, servir la galería HTML original (backup)
  if (!action) {
    return HtmlService.createHtmlOutput(buildGalleryHtml())
      .setTitle('📸 Photo Analyzer')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // API mode: retornar JSON
  try {
    var result;
    
    switch (action) {
      case 'getData':
        result = getGalleryData();
        break;
        
      case 'reviewOne':
        var file = e.parameter.file || '';
        if (!file) throw new Error('Falta parámetro file');
        result = reviewSelectedPhotos([file]);
        break;
        
      case 'discard':
        var files = (e.parameter.files || '').split(',').filter(function(f) { return f; });
        if (!files.length) throw new Error('Falta parámetro files');
        result = discardPhotos(files);
        break;
        
      case 'delete':
        var files = (e.parameter.files || '').split(',').filter(function(f) { return f; });
        if (!files.length) throw new Error('Falta parámetro files');
        result = deletePhotos(files);
        break;
        
      default:
        throw new Error('Acción no reconocida: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// doPost como alternativa para operaciones de escritura
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var result;
    
    switch (action) {
      case 'reviewOne':
        result = reviewSelectedPhotos([body.file]);
        break;
      case 'discard':
        result = discardPhotos(body.files || []);
        break;
      case 'delete':
        result = deletePhotos(body.files || []);
        break;
      default:
        throw new Error('Acción no reconocida: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
