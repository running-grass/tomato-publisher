{
  description = "tomato-publisher：Node + pnpm + Chromium（Puppeteer）";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      inherit (nixpkgs.lib) genAttrs;
      forAllSystems = f: genAttrs systems (system: f (import nixpkgs { inherit system; }));
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            chromium
            chafa
          ];
          CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
          FANQIE_USER_DATA_DIR = "./.local";
        };
      });
    };
}
