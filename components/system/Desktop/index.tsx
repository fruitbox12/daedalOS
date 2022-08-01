import StyledDesktop from "components/system/Desktop/StyledDesktop";
import loadFileWallpaper from "components/system/Desktop/Wallpapers/useWallpaper";
import FileManager from "components/system/Files/FileManager";
import { useRef } from "react";
import { DESKTOP_PATH } from "utils/constants";

const Desktop: FC = ({ children }) => {
  const desktopRef = useRef<HTMLElement | null>(null);

  loadFileWallpaper(desktopRef);

  return (
    <StyledDesktop ref={desktopRef}>
      <FileManager
        url={DESKTOP_PATH}
        view="icon"
        hideLoading
        hideScrolling
        isDesktop
        loadIconsImmediately
      />
      {children}
    </StyledDesktop>
  );
};

export default Desktop;
