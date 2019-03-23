module.exports = {

    normalizarTitular(titular){        
        titular = this.eliminarDiacriticosEs(titular.toLowerCase());

        titular = titular.replace(/[.,:;¡!¿?'"]/g, ''); // quitar los signos .,;¡!¿?'""
        titular = titular.replace(/\s+/g,' ').trim(); // quitar espacios extra
        return titular;
    },

    /* Elimina los diacríticos exclusivamente de áéíóúü. No afecta a "ñ" ni otros diacríticos de otros idiomas.
    https://es.stackoverflow.com/a/62032 */
    eliminarDiacriticosEs(texto){
        return texto.normalize('NFD').replace(/([aeio])\u0301|(u)[\u0301\u0308]/gi,"$1$2").normalize();
    },

    'listanegra': {
        "descubierto el perro verde": {fuente: "Javi y Joan", fecha: "23-3-2019", original: "Descubierto el perro verde"},
        "la nube de contaminacion que hay sobre barcelona ya es mas bonita que las nubes normales": {fuente: "El mundo today", fecha: "21-3-2019", original: "La nube de contaminación que hay sobre Barcelona ya es más bonita que las nubes normales"},
        "zidane vuelve a dimitir tras comprobar que siguen los mismos jugadores del año pasado": {fuente: "El mundo today", fecha: "20-3-2019", original: "Zidane vuelve a dimitir tras comprobar que siguen los mismos jugadores del año pasado"},
        "cura cierra la puerta de la iglesia con llave para que no se escape dios": {fuente: "El mundo today", fecha: "23-3-2019", original: "Cura cierra la puerta de la iglesia con llave para que no se escape Dios"},
    },

    'fuentesnegras': {
        'doce minutos': true,
        'diario información': true,
        'el mundo today': true
    }
}