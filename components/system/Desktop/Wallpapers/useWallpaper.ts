import {
  BASE_CANVAS_SELECTOR,
  BRIGHT_WALLPAPERS,
  cssFit,
  WALLPAPER_WORKERS,
} from "components/system/Desktop/Wallpapers/constants";
import hexells from "components/system/Desktop/Wallpapers/hexells";
import coastalLandscape from "components/system/Desktop/Wallpapers/ShaderToy/CoastalLandscape";
import { useFileSystem } from "contexts/fileSystem";
import { useSession } from "contexts/session";
import useWorker from "hooks/useWorker";
import { useCallback, useEffect } from "react";
import { MILLISECONDS_IN_DAY, ONE_TIME_PASSIVE_EVENT } from "utils/constants";
import {
  bufferToUrl,
  cleanUpBufferUrl,
  createOffscreenCanvas,
  getYouTubeUrlId,
  isYouTubeUrl,
  jsonFetch,
  viewWidth,
} from "utils/functions";

const WALLPAPER_WORKER_NAMES = Object.keys(WALLPAPER_WORKERS);

const useWallpaper = (
  desktopRef: React.MutableRefObject<HTMLElement | null>
): void => {
  const { exists, readFile } = useFileSystem();
  const { sessionLoaded, setWallpaper, wallpaperImage, wallpaperFit } =
    useSession();
  const [wallpaperName] = wallpaperImage.split(" ");
  const vantaWireframe = wallpaperImage === "APOD";
  const wallpaperWorker = useWorker<void>(
    WALLPAPER_WORKERS[wallpaperName],
    undefined,
    vantaWireframe ? "Wireframe" : "APOD"
  );
  const resizeListener = useCallback(() => {
    if (!desktopRef.current) return;

    const desktopRect = desktopRef.current.getBoundingClientRect();

    wallpaperWorker.current?.postMessage(desktopRect);

    const canvasElement =
      desktopRef.current.querySelector(BASE_CANVAS_SELECTOR);

    if (canvasElement instanceof HTMLCanvasElement) {
      canvasElement.style.width = `${desktopRect.width}px`;
      canvasElement.style.height = `${desktopRect.height}px`;
    }
  }, [desktopRef, wallpaperWorker]);
  const loadWallpaper = useCallback(() => {
    if (desktopRef.current) {
      const vantaConfig = "";

      desktopRef.current.setAttribute("style", "");
      desktopRef.current.querySelector(BASE_CANVAS_SELECTOR)?.remove();

      if (
        typeof window.OffscreenCanvas !== "undefined" &&
        wallpaperWorker.current
      ) {
        const offscreen = createOffscreenCanvas(desktopRef.current);

        wallpaperWorker.current.postMessage(
          {
            canvas: offscreen,
            config: wallpaperName === "APOD" ? vantaConfig : undefined,
            devicePixelRatio: 1,
          },
          [offscreen]
        );

        window.removeEventListener("resize", resizeListener);
        window.addEventListener("resize", resizeListener, { passive: true });
      } else if (wallpaperName === "VANTA") {
        setWallpaper("APOD");
      } else if (wallpaperName === "HEXELLS") {
        hexells(desktopRef.current);
      } else if (wallpaperName === "COASTAL_LANDSCAPE") {
        coastalLandscape(desktopRef.current);
      } else {
        setWallpaper("APOD");
      }

      if (BRIGHT_WALLPAPERS[wallpaperName]) {
        desktopRef.current
          ?.querySelector(BASE_CANVAS_SELECTOR)
          ?.setAttribute(
            "style",
            `filter: brightness(${BRIGHT_WALLPAPERS[wallpaperName]})`
          );
      }
    }
  }, [
    desktopRef,
    resizeListener,
    setWallpaper,
    wallpaperName,
    wallpaperWorker,
  ]);
  const loadFileWallpaper = useCallback(async () => {
    const [, currentWallpaperUrl] =
      desktopRef.current?.style.backgroundImage.match(/"(.*?)"/) || [];

    if (currentWallpaperUrl === wallpaperImage) return;
    if (currentWallpaperUrl) cleanUpBufferUrl(currentWallpaperUrl);
    desktopRef.current?.setAttribute("style", "");
    desktopRef.current?.querySelector(BASE_CANVAS_SELECTOR)?.remove();

    let wallpaperUrl = "";
    let fallbackBackground = "";
    let newWallpaperFit = wallpaperFit;

    if (wallpaperName === "APOD") {
      const [, currentUrl, currentDate] = wallpaperImage.split(" ");
      const [month, , day, , year] = new Intl.DateTimeFormat("en-US", {
        timeZone: "US/Eastern",
      })
        .formatToParts(Date.now())
        .map(({ value }) => value);

      if (currentDate === `${year}-${month}-${day}`) {
        wallpaperUrl = currentUrl;
      } else {
        const {
          date = "",
          hdurl = "",
          url = "",
        } = await jsonFetch(
          "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY"
        );

        if (hdurl || url) {
          wallpaperUrl = ((viewWidth() > 1024 ? hdurl : url) || url) as string;
          newWallpaperFit = "center";

          if (isYouTubeUrl(wallpaperUrl)) {
            wallpaperUrl = `https://i.ytimg.com/vi/${getYouTubeUrlId(
              wallpaperUrl
            )}/maxresdefault.jpg`;
          }

          if (hdurl && url && hdurl !== url) {
            fallbackBackground = (wallpaperUrl === url ? hdurl : url) as string;
          }

          const newWallpaperImage = `APOD ${wallpaperUrl} ${date as string}`;

          if (newWallpaperImage !== wallpaperImage) {
            setWallpaper(newWallpaperImage, newWallpaperFit);
            setTimeout(loadWallpaper, MILLISECONDS_IN_DAY);
          }
        }
      }
    } else if (await exists(wallpaperImage)) {
      wallpaperUrl = bufferToUrl(await readFile(wallpaperImage));
    }

    if (wallpaperUrl) {
      const wallpaperStyle = (url: string): string => `
        background-image: url(${url});
        ${cssFit[newWallpaperFit]}
      `;

      desktopRef.current?.setAttribute("style", wallpaperStyle(wallpaperUrl));

      if (fallbackBackground) {
        const img = document.createElement("img");

        img.addEventListener(
          "error",
          () =>
            desktopRef.current?.setAttribute(
              "style",
              wallpaperStyle(fallbackBackground)
            ),
          ONE_TIME_PASSIVE_EVENT
        );
        img.src = wallpaperUrl;
      }
    } else {
      loadWallpaper();
    }
  }, [
    desktopRef,
    exists,
    loadWallpaper,
    readFile,
    setWallpaper,
    wallpaperFit,
    wallpaperImage,
    wallpaperName,
  ]);

  useEffect(() => {
    if (sessionLoaded) {
      if (wallpaperName) {
        if (WALLPAPER_WORKER_NAMES.includes(wallpaperName)) {
          loadFileWallpaper();
        } else {
          loadFileWallpaper().catch(loadWallpaper);
        }
      } else {
        loadWallpaper();
      }
    }
  }, [loadFileWallpaper, loadWallpaper, sessionLoaded, wallpaperName]);
};

export default useWallpaper;
