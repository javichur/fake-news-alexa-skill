/* eslint-disable  func-names */
/* eslint-disable  no-console */

/* 1. Cargamos las dependencias. */
let https = require('https');
const Alexa = require('ask-sdk-core');

const DBHelper = require('./helpers/dbHelper');
let myDb = new DBHelper("noticiasfalsas", "titular", null);
const ATTR_NAME = "listado";


const subscriptionKey = "<API KEY AZURE AQUI>";

const OTRA_O_SALIR = ". Pregúntame otra o di salir.";

/* 2. Constantes */
const skillBuilder = Alexa.SkillBuilders.custom();
const HELP_MESSAGE = 'Esta skill te ayuda a detectar noticias falsas. Di por ejemplo: "Busca" y el título de la noticia.';
const HELP_REPROMPT = HELP_MESSAGE;
const STOP_MESSAGE = '<say-as interpret-as="interjection">Hasta luego</say-as>';
const NO_ENTIENDO_REPITE_POR_FAVOR = '<say-as interpret-as="interjection">¿cómorr?</say-as>. Lo siento, no te he entendido. Repite por favor.';


/* 3. Manejadores */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const {responseBuilder } = handlerInput;
    const userID = handlerInput.requestEnvelope.context.System.user.userId; 
    
    let speechText = HELP_MESSAGE;
    
    return responseBuilder
          .speak(speechText)
          .reprompt(speechText)
          .getResponse();
  }
};


const BuscarHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'BuscarIntent';
  },
  async handle(handlerInput) {    
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const listaNegra = require('./data/listanegra.js');

    const tituloSlot = handlerInput.requestEnvelope.request.intent.slots.tituloSlot;
    const fuente = handlerInput.requestEnvelope.request.intent.slots.fuenteSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name;

    // 1. lo buscamos en lista negra de periódicos.
    if(fuente && fuente != "no lo sé"){

      let fila = listaNegra['fuentesnegras'][fuente];
      if(fila){
        return handlerInput.responseBuilder
            .speak("¡Ésta es fácil! Las noticias de " + fuente + " son falsas. Es un periódico de broma" + OTRA_O_SALIR)    
            .reprompt(OTRA_O_SALIR)
            .getResponse();
      }
    }

    if (tituloSlot && tituloSlot.value) 
    {
      const titular = tituloSlot.value;

      // 2. lo buscamos en lista negra de titulares.      
      const titularNormalizado = listaNegra.normalizarTitular(titular);

      let fila = listaNegra['listanegra'][titularNormalizado];
      if(fila){
        let ret = "Noticia falsa detectada en la lista negra. El titular '" + fila.original + 
                  "' fue publicado por " + fila.fuente + " en fecha " + fila.fecha.replace(":00.0000000Z", "");
        return handlerInput.responseBuilder
            .speak(ret + OTRA_O_SALIR)        
            .reprompt(OTRA_O_SALIR)
            .getResponse();
      }

    
      const {responseBuilder } = handlerInput;

      // 3. Buscar en Azure Bing News el titular exacto
      let respuesta = JSON.parse(await bing_news_search(titular));

      if(respuesta && respuesta.value){
        for(let i=0; i<respuesta.value.length; i++){
          let unNormal = listaNegra.normalizarTitular(respuesta.value[i].name);
          if(unNormal == titularNormalizado){
            let provider = obtenerFuente(respuesta.value[i]);
            let fecha = (respuesta.value[i].datePublished) ? respuesta.value[i].datePublished : "desconocida";

            return handlerInput.responseBuilder
              .speak("Noticia real, publicada por " + provider + " en fecha " + fecha.replace(":00.0000000Z", "") + ". El titular original fue: " + respuesta.value[i].name + OTRA_O_SALIR) 
              .reprompt(OTRA_O_SALIR)       
              .getResponse();
          }
          
        }
      }

      // 4. lo buscamos en la lista de noticias no encontradas pero ya buscadas por usuarios
      const userID = handlerInput.requestEnvelope.context.System.user.userId;
      
      return myDb.getItem(titularNormalizado)
      .then((data) => {
        var speechText = "";
        if(!data){
          speechText = "No he encontrado info sobre este titular y además eres la primera persona en preguntar por él" + OTRA_O_SALIR;
          data = {};
          data[ATTR_NAME] = [];
          data[ATTR_NAME].unshift(userID);
        }
        else {
          if(!data[ATTR_NAME].includes(userID)){            
            data[ATTR_NAME].unshift(userID); // si no está el user entre los que ya han buscado esta noticia, incluirlo
          }

          speechText = "No he encontrado info sobre este titular pero sois ya " + 
                          data[ATTR_NAME].length + " personas preguntando por él" + OTRA_O_SALIR;
        }

        let itemAttributes = {};
        itemAttributes[ATTR_NAME] = data[ATTR_NAME];

        return myDb.updateItem(titularNormalizado, itemAttributes)
          .then((data) => {
              return responseBuilder
                .speak(speechText)
                .reprompt(speechText)
                .getResponse();
          })
          .catch((err) => {
            console.log("Error guardando. " + err);
            return responseBuilder
                .speak("Error" + OTRA_O_SALIR)
                .reprompt(OTRA_O_SALIR)
                .getResponse();
        });


        return responseBuilder
          .speak(speechText)
          .reprompt(speechText)
          .getResponse();
      })
      .catch((err) => {
        const speechText = "Error al intentar recordar información. " + err;
        return responseBuilder
          .speak(speechText)
          .reprompt(speechText)
          .getResponse();
      });

      return handlerInput.responseBuilder
        .speak("No he encontrado información sobre el titular" + OTRA_O_SALIR)        
        .reprompt(OTRA_O_SALIR)
        .getResponse();

    }
  }
};

function obtenerFuente(item){

  if(item && item.provider && item.provider[0] && item.provider[0].name) return item.provider[0].name;

  return "desconocido";
}

const HelpHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {    
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};


const ExitHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput) {    
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)      
      .withShouldEndSession(true) /* Para cerrar sesión. */
      .getResponse();
  },
};


const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};


const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`); // imprimiremos el error por consola    
    
    return handlerInput.responseBuilder
      .speak(NO_ENTIENDO_REPITE_POR_FAVOR)
      .reprompt(NO_ENTIENDO_REPITE_POR_FAVOR)
      .getResponse();
  },
};

let host = 'api.cognitive.microsoft.com';
let path = '/bing/v7.0/news/search';


let bing_news_search = function (search) {
    return new Promise(((resolve, reject) => {
        console.log('Searching news for: ' + search);
        let request_params = {
                method : 'GET',
                hostname : host,
                path : path + '?q=' + encodeURIComponent(search) + 
                              "&mkt=es-ES&" +
                              "setLang=es-ES&" +
                              "count=5",
                headers : {
                    'Ocp-Apim-Subscription-Key' : subscriptionKey,
                }
            };


        const request = https.request(request_params, (response) => {                  
          
          let returnData = '';
    
          response.on('data', (chunk) => {
            returnData += chunk;
          });
    
          response.on('end', () => {
            resolve(returnData);
          });
    
          response.on('error', (error) => {
            console.log("error: " + error);
            reject(null);
          });
        });
        request.end();
      }));
}





/* 5. Configuración de Lambda */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    BuscarHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

