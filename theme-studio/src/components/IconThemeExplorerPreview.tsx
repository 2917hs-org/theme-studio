import type { IconThemePreviewAssets } from '../theme/iconThemeAssets';
import { FolderIcon, GenericFileIcon } from './icons';

interface IconThemeExplorerPreviewProps {
  assets: IconThemePreviewAssets;
  background: string;
  foreground: string;
}

/**
 * A small, fixed sample file tree — not the user's own project — rendered
 * with the icon theme's *real* resolved icons (see iconThemeAssets.ts),
 * against the color theme's own editor background so the two are at least
 * seen side by side. Purely decorative and non-interactive, same spirit as
 * ThemePreview.tsx for the code side: a preview surface, not a second
 * editable Explorer.
 */
export function IconThemeExplorerPreview({ assets, background, foreground }: IconThemeExplorerPreviewProps) {
  return (
    <div className="icon-explorer-preview" style={{ background, color: foreground }}>
      <div className="icon-explorer-row">
        {assets.folderClosed ? (
          <img src={assets.folderClosed} alt="" className="icon-explorer-icon" />
        ) : (
          <FolderIcon size={14} className="icon-explorer-icon icon-explorer-icon-fallback" />
        )}
        <span>src</span>
      </div>
      <div className="icon-explorer-row">
        {assets.folderOpen ? (
          <img src={assets.folderOpen} alt="" className="icon-explorer-icon" />
        ) : (
          <FolderIcon size={14} className="icon-explorer-icon icon-explorer-icon-fallback" />
        )}
        <span>components</span>
      </div>
      {assets.files.map((f) => (
        <div className="icon-explorer-row icon-explorer-row-nested" key={f.name}>
          {f.dataUri ? (
            <img src={f.dataUri} alt="" className="icon-explorer-icon" />
          ) : (
            <GenericFileIcon size={14} className="icon-explorer-icon icon-explorer-icon-fallback" />
          )}
          <span>{f.name}</span>
        </div>
      ))}
      {assets.usesIconFonts && (
        <div className="icon-explorer-note">This theme uses icon fonts for some icons — those show as a generic file icon here.</div>
      )}
    </div>
  );
}
