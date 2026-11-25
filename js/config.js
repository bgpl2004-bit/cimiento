/* Configuración de Firebase (opcional).
 * Mientras esté vacía, Cimiento funciona en "modo local" (solo este navegador).
 * Para que dos celulares compartan los datos, pega aquí la configuración web de tu proyecto Firebase:
 *   Consola de Firebase > Configuración del proyecto > Tus apps > App web > "Configuración del SDK".
 * Luego activa Firestore Database en modo de prueba (ver README.md).
 */
window.CIMIENTO_FIREBASE = null;
// Versión de la app (se muestra en «Acerca de este prototipo» y se guarda en cada evento del registro de pruebas).
window.CIMIENTO_VERSION = "0.22";
/* Ejemplo:
window.CIMIENTO_FIREBASE = {
  apiKey: "...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
*/
