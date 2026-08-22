/**
 * Preset de Tailwind para @tu-scope/master-crud.
 *
 * Los componentes de este paquete usan clases como `bg-ink`, `text-slate`,
 * `bg-moss-light`, `rounded-xl2`, etc. Esos NO son colores/tamaños de
 * Tailwind por defecto — son tokens de diseño propios. Para que Tailwind
 * genere el CSS de esas clases en TU proyecto (el que instala este
 * paquete), agrega este preset a tu `tailwind.config.js`:
 *
 *   // tailwind.config.js
 *   module.exports = {
 *     presets: [require('@tu-scope/master-crud/tailwind-preset')],
 *     content: [
 *       "./src/**\/*.{js,ts,jsx,tsx}",
 *       // Importante: Tailwind no escanea node_modules por defecto.
 *       // Agrega esta línea para que también genere las clases usadas
 *       // dentro del paquete compilado:
 *       "./node_modules/@tu-scope/master-crud/dist/**\/*.js",
 *     ],
 *   };
 *
 * Si tu proyecto ya tiene sus propios tokens con estos mismos nombres
 * (por ejemplo si vienes del proyecto "finanzas-personales" de este mismo
 * autor), no necesitas el preset: ya son compatibles.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: "#10171F",
        paper: "#F6F7F5",
        surface: "#FFFFFF",
        mist: "#EDEFEC",
        line: "#E2E5E0",
        moss: "#1F6D5A",
        "moss-light": "#E7F3EF",
        clay: "#B4483A",
        "clay-light": "#F8E9E7",
        slate: "#5B6570",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(16, 23, 31, 0.06)",
        card: "0 4px 20px rgba(16, 23, 31, 0.08)",
      },
    },
  },
};
