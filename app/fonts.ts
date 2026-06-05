import localFont from "next/font/local";

export const neueHaas = localFont({
  src: [
    {
      path: "../src/fonts/neuehaasgrotdispround-55roman-trial.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../src/fonts/neuehaasgrotdispround-65medium-trial.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../src/fonts/neuehaasgrotdispround-75bold-trial.otf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
});