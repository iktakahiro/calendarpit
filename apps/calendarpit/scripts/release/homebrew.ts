import { archiveName, releaseVersion } from './artifacts';
import type { ReleasePlatform } from './targets';

/** Generates a tap formula using the already-built, checksummed release archives. */
export function homebrewFormula(checksums: ReadonlyMap<string, string>) {
  function download(platform: ReleasePlatform) {
    const name = archiveName(platform);
    const hash = checksums.get(name);
    if (!hash || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error(`Missing SHA-256 for ${name}`);
    return `url "https://github.com/iktakahiro/calendarpit/releases/download/v${releaseVersion}/${name}"\n      sha256 "${hash}"`;
  }
  return `class Calendarpit < Formula
  desc "Local Google Calendar-compatible API and OAuth server for development"
  homepage "https://iktakahiro.github.io/calendarpit/"
  version "${releaseVersion}"
  license "MIT"

  on_macos do
    on_arm do
      ${download('darwin-arm64')}
    end
    on_intel do
      ${download('darwin-x64')}
    end
  end

  on_linux do
    on_arm do
      ${download('linux-arm64')}
    end
    on_intel do
      ${download('linux-x64')}
    end
  end

  def install
    bin.install "bin/calendarpit"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/calendarpit --version").strip
  end
end
`;
}
