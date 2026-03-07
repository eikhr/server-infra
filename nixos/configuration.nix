{ config, pkgs, ... }:

{
  imports = [
    ./hardware-configuration.nix
  ];

  # Boot
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Network
  networking.hostName = "eikhr-server";
  networking.networkmanager.enable = true;

  # Firewall
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22    # SSH
      80    # HTTP
      443   # HTTPS
      25565 # Minecraft
    ];
  };

  # Locale & time
  time.timeZone = "Europe/Oslo";

  # Users
  users.users.eik = {
    isNormalUser = true;
    extraGroups = [ "docker" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP+2s2TrKjO+yCXJ1Esel5/8+0ko5ueryJUuGEEeyKjn eik@server"
    ];
  };

  # SSH
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
    };
  };

  # Docker
  virtualisation.docker = {
    enable = true;
    autoPrune.enable = true;
  };

  # Packages
  environment.systemPackages = with pkgs; [
    git
    gh
    docker-compose
    vim
    htop
    curl
  ];

  # Disable suspend/sleep (it's a server)
  services.logind.lidSwitch = "ignore";
  systemd.targets.sleep.enable = false;
  systemd.targets.suspend.enable = false;
  systemd.targets.hibernate.enable = false;
  systemd.targets.hybrid-sleep.enable = false;

  system.stateVersion = "24.11";
}
