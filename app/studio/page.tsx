'use client';

// POLYFILL BUFFER UNTUK BROWSER
if (typeof window !== 'undefined') {
    const { Buffer } = require('buffer');
    (window as any).Buffer = Buffer;
}

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { LuminaWallet, LuminaClient, LuminaUtils } from 'lumina-blockchain-sdk';
import { bech32m } from 'bech32';
import {
    Terminal as TerminalIcon, Code, Cpu, ShieldCheck,
    Activity, Plus, Box, Zap, Settings, Binary,
    ChevronDown, ChevronUp, X, Layout, Maximize2, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper buat bikin alamat lumina1... dari hash (20 bytes)
function toLuminaAddress(hashHex: any): string {
    if (!hashHex) return "";
    try {
        if (typeof hashHex === 'string' && hashHex.includes('1')) return hashHex;

        let str = "";
        if (typeof hashHex === 'string') {
            str = hashHex;
        } else if (hashHex instanceof Uint8Array || Array.isArray(hashHex)) {
            str = Array.from(hashHex as number[]).map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            str = String(hashHex);
        }

        const cleanHex = str.startsWith('0x') ? str.substring(2) : str;
        if (!/^[0-9a-fA-F]+$/.test(cleanHex)) return str;

        const matches = cleanHex.match(/.{1,2}/g);
        if (!matches) return str;

        const bytes = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
        const words = bech32m.toWords(bytes.slice(0, 20));
        return bech32m.encode('lumina', words);
    } catch (e) {
        return String(hashHex);
    }
}

declare global {
  interface Window {
    lumina?: {
      isLumina: boolean;
      isConnected: () => boolean;
      getAddress: () => string | null;
      request: (req: { method: string; params?: any }) => Promise<any>;
      on: (event: string, callback: (data: any) => void) => void;
      removeListener: (event: string, callback: (data: any) => void) => void;
    };
  }
}

export default function SmartContractStudio() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<string>("0.000000");
    const [gasLimit, setGasLimit] = useState('0.001');
    const [compilerVersion, setCompilerVersion] = useState('1.95.0');
    const compilerMapping: Record<string, string> = {
        'Local (9091)': 'http://localhost:9091',
        '1.95.0': 'https://compiler1950.bariscode.my.id',
        '1.94.0': 'https://vps-194.lumina.network',
        '1.93.0': 'https://vps-193.lumina.network',
        '1.92.0': 'https://vps-192.lumina.network',
        '1.91.0': 'https://vps-191.lumina.network',
        '1.90.0': 'https://vps-190.lumina.network',
        '1.89.0': 'https://vps-189.lumina.network',
        '1.88.0': 'https://vps-188.lumina.network',
        '1.87.0': 'https://vps-187.lumina.network',
        '1.86.0': 'https://vps-186.lumina.network',
    };
    const rustVersions = Object.keys(compilerMapping).sort().reverse();

    // PATOKAN: Menggunakan isi dari example-sc.rs
    const [code, setCode] = useState(`// ============================================================================
//  LTS-20 Token Standard — Lumina Protocol
//  Adapted to use the official Lumina Standards Library (LSL)
//  Features: Transfer, Approve, Mint, Burn, Pause, Ownership, Custom Blacklist
// ============================================================================

#![no_std]
use lumina_std::*;
use lumina_std::standards::ownable::Ownable;
use lumina_std::standards::pausable::Pausable;
use lumina_std::standards::lts20::Lts20;

#[lumina_contract]
pub mod lts20_token {
    use super::*;

    // ─────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────

    const NAME: &str = "Tether USDT";
    const SYMBOL: &str = "USDT";
    const DECIMALS: u8 = 18;
    const MAX_SUPPLY: u128 = 1_000_000_000 * 10u128.pow(18); // 1 Billion max

    // ─────────────────────────────────────────────
    // CUSTOM STORAGE KEY HELPERS (EXTENDING STANDARDS)
    // ─────────────────────────────────────────────

    fn key_blacklist(addr: &Address) -> String {
        format!("blacklist:{}", addr)
    }

    fn key_minter(addr: &Address) -> String {
        format!("minter:{}", addr)
    }

    // ─────────────────────────────────────────────
    // CUSTOM GUARDS
    // ─────────────────────────────────────────────

    fn not_blacklisted(addr: &Address) {
        let banned: bool = storage::read(key_blacklist(addr)).unwrap_or(false);
        assert!(!banned, "Address is blacklisted");
    }

    fn valid_address(addr: &Address) {
        assert!(!addr.is_zero(), "Invalid zero address");
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    /// Initialize token — called once during deployment
    #[init]
    pub fn initialize() {
        let initial_supply: u128 = 1_000_000 * 10u128.pow(18); // 1 Million initial
        
        let owner = get_caller();
        valid_address(&owner);

        // Initialize library standards!
        Ownable::initialize(&owner);
        Pausable::initialize(false);

        // Mint initial supply using LTS-20 standard helper
        Lts20::mint(&owner, initial_supply);

        log(&format!(
            "[INIT] {} ({}) deployed via Lumina Standards | Supply: {} | Owner: {}",
            NAME, SYMBOL, initial_supply, owner
        ));
    }

    // ─────────────────────────────────────────────
    // READ-ONLY QUERIES (VIEWS)
    // ─────────────────────────────────────────────

    #[view]
    pub fn name() -> String {
        NAME.to_string()
    }

    #[view]
    pub fn symbol() -> String {
        SYMBOL.to_string()
    }

    #[view]
    pub fn decimals() -> u8 {
        DECIMALS
    }

    #[view]
    pub fn logo() -> String {
        "https://cryptologos.cc/logos/tether-usdt-logo.png".to_string()
    }

    #[view]
    pub fn total_supply() -> u128 {
        Lts20::total_supply()
    }

    #[view]
    pub fn balance_of(account: Address) -> u128 {
        Lts20::balance_of(&account)
    }

    #[view]
    pub fn allowance(owner: Address, spender: Address) -> u128 {
        Lts20::allowance(&owner, &spender)
    }

    #[view]
    pub fn is_paused() -> bool {
        Pausable::paused()
    }

    #[view]
    pub fn is_blacklisted(account: Address) -> bool {
        storage::read(&key_blacklist(&account)).unwrap_or(false)
    }

    #[view]
    pub fn owner() -> Address {
        Ownable::owner().expect("Owner not initialized")
    }

    #[view]
    pub fn is_minter(account: Address) -> bool {
        storage::read(&key_minter(&account)).unwrap_or(false)
    }

    // ─────────────────────────────────────────────
    // CORE TRANSACTION ENDPOINTS
    // ─────────────────────────────────────────────

    /// Transfer token to another address
    #[endpoint]
    pub fn transfer(to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let from = get_caller();
        valid_address(&to);
        not_blacklisted(&from);
        not_blacklisted(&to);

        assert!(from != to, "Cannot transfer to yourself");
        assert!(amount > 0, "Amount must be > 0");

        Lts20::transfer(&from, &to, amount);
    }

    /// Transfer from another account using allowance
    #[endpoint]
    pub fn transfer_from(from: Address, to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let spender = get_caller();
        valid_address(&from);
        valid_address(&to);
        not_blacklisted(&from);
        not_blacklisted(&to);
        not_blacklisted(&spender);

        assert!(amount > 0, "Amount must be > 0");

        Lts20::transfer_from(&spender, &from, &to, amount);
    }

    /// Set allowance for a spender
    #[endpoint]
    pub fn approve(spender: Address, amount: u128) {
        Pausable::assert_not_paused();

        let owner = get_caller();
        valid_address(&spender);
        not_blacklisted(&owner);
        not_blacklisted(&spender);

        assert!(owner != spender, "Cannot approve yourself");

        Lts20::approve(&owner, &spender, amount);
    }

    // ─────────────────────────────────────────────
    // MINT & BURN (WITH CUSTOM MINTER/BLACKLIST GUARDS)
    // ─────────────────────────────────────────────

    /// Mint new tokens — accessible by owner or authorized minters
    #[endpoint]
    pub fn mint(to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let caller = get_caller();
        let owner_addr = Ownable::owner().expect("Owner not set");
        let caller_is_minter = storage::read(&key_minter(&caller)).unwrap_or(false);

        assert!(
            caller == owner_addr || caller_is_minter,
            "Access denied: not owner or minter"
        );

        valid_address(&to);
        not_blacklisted(&to);
        assert!(amount > 0, "Mint amount must be > 0");

        let current_supply = Lts20::total_supply();
        assert!(current_supply + amount <= MAX_SUPPLY, "Exceeds max supply cap");

        Lts20::mint(&to, amount);
    }

    /// Burn tokens from the caller's balance
    #[endpoint]
    pub fn burn(amount: u128) {
        Pausable::assert_not_paused();

        let caller = get_caller();
        not_blacklisted(&caller);
        assert!(amount > 0, "Burn amount must be > 0");

        Lts20::burn(&caller, amount);
    }

    // ─────────────────────────────────────────────
    // ADMIN ENDPOINTS (PAUSE, BLACKLIST, OWNERSHIP)
    // ─────────────────────────────────────────────

    #[endpoint]
    pub fn pause() {
        Ownable::assert_only_owner();
        Pausable::set_paused(true);
    }

    #[endpoint]
    pub fn unpause() {
        Ownable::assert_only_owner();
        Pausable::set_paused(false);
    }

    #[endpoint]
    pub fn blacklist(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_blacklist(&account), &true);
        emit_event("Blacklisted", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn unblacklist(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_blacklist(&account), &false);
        emit_event("Unblacklisted", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn add_minter(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_minter(&account), &true);
        emit_event("MinterAdded", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn remove_minter(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_minter(&account), &false);
        emit_event("MinterRemoved", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn transfer_ownership(new_owner: Address) {
        // Automatically checks if caller is owner and transfers securely
        Ownable::transfer_ownership(new_owner);
    }
}
`);

    const [logs, setLogs] = useState<{ msg: string, type: 'info' | 'error' | 'success' | 'tech' }[]>([]);
    const [privKey, setPrivKey] = useState('');
    const [isTerminalVisible, setIsTerminalVisible] = useState(true);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isCompiled, setIsCompiled] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [contractId, setContractId] = useState('');
    const [compilationArtifacts, setCompilationArtifacts] = useState<{ bytecode: string, abi: any } | null>(null);
    
    // IDE Tab State
    const [openTabs, setOpenTabs] = useState<Array<{ id: string, name: string, content: string, isSdk: boolean }>>([
        { id: 'lib.rs', name: 'lib.rs', content: `// ============================================================================
//  LTS-20 Token Standard — Lumina Protocol
//  Adapted to use the official Lumina Standards Library (LSL)
//  Features: Transfer, Approve, Mint, Burn, Pause, Ownership, Custom Blacklist
// ============================================================================

#![no_std]
use lumina_std::*;
use lumina_std::standards::ownable::Ownable;
use lumina_std::standards::pausable::Pausable;
use lumina_std::standards::lts20::Lts20;

#[lumina_contract]
pub mod lts20_token {
    use super::*;

    // ─────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────

    const NAME: &str = "Tether USDT";
    const SYMBOL: &str = "USDT";
    const DECIMALS: u8 = 18;
    const MAX_SUPPLY: u128 = 1_000_000_000 * 10u128.pow(18); // 1 Billion max

    // ─────────────────────────────────────────────
    // CUSTOM STORAGE KEY HELPERS (EXTENDING STANDARDS)
    // ─────────────────────────────────────────────

    fn key_blacklist(addr: &Address) -> String {
        format!("blacklist:{}", addr)
    }

    fn key_minter(addr: &Address) -> String {
        format!("minter:{}", addr)
    }

    // ─────────────────────────────────────────────
    // CUSTOM GUARDS
    // ─────────────────────────────────────────────

    fn not_blacklisted(addr: &Address) {
        let banned: bool = storage::read(key_blacklist(addr)).unwrap_or(false);
        assert!(!banned, "Address is blacklisted");
    }

    fn valid_address(addr: &Address) {
        assert!(!addr.is_zero(), "Invalid zero address");
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    /// Initialize token — called once during deployment
    #[init]
    pub fn initialize() {
        let initial_supply: u128 = 1_000_000 * 10u128.pow(18); // 1 Million initial
        
        let owner = get_caller();
        valid_address(&owner);

        // Initialize library standards!
        Ownable::initialize(&owner);
        Pausable::initialize(false);

        // Mint initial supply using LTS-20 standard helper
        Lts20::mint(&owner, initial_supply);

        log(&format!(
            "[INIT] {} ({}) deployed via Lumina Standards | Supply: {} | Owner: {}",
            NAME, SYMBOL, initial_supply, owner
        ));
    }

    // ─────────────────────────────────────────────
    // READ-ONLY QUERIES (VIEWS)
    // ─────────────────────────────────────────────

    #[view]
    pub fn name() -> String {
        NAME.to_string()
    }

    #[view]
    pub fn symbol() -> String {
        SYMBOL.to_string()
    }

    #[view]
    pub fn decimals() -> u8 {
        DECIMALS
    }

    #[view]
    pub fn logo() -> String {
        "https://cryptologos.cc/logos/tether-usdt-logo.png".to_string()
    }

    #[view]
    pub fn total_supply() -> u128 {
        Lts20::total_supply()
    }

    #[view]
    pub fn balance_of(account: Address) -> u128 {
        Lts20::balance_of(&account)
    }

    #[view]
    pub fn allowance(owner: Address, spender: Address) -> u128 {
        Lts20::allowance(&owner, &spender)
    }

    #[view]
    pub fn is_paused() -> bool {
        Pausable::paused()
    }

    #[view]
    pub fn is_blacklisted(account: Address) -> bool {
        storage::read(&key_blacklist(&account)).unwrap_or(false)
    }

    #[view]
    pub fn owner() -> Address {
        Ownable::owner().expect("Owner not initialized")
    }

    #[view]
    pub fn is_minter(account: Address) -> bool {
        storage::read(&key_minter(&account)).unwrap_or(false)
    }

    // ─────────────────────────────────────────────
    // CORE TRANSACTION ENDPOINTS
    // ─────────────────────────────────────────────

    /// Transfer token to another address
    #[endpoint]
    pub fn transfer(to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let from = get_caller();
        valid_address(&to);
        not_blacklisted(&from);
        not_blacklisted(&to);

        assert!(from != to, "Cannot transfer to yourself");
        assert!(amount > 0, "Amount must be > 0");

        Lts20::transfer(&from, &to, amount);
    }

    /// Transfer from another account using allowance
    #[endpoint]
    pub fn transfer_from(from: Address, to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let spender = get_caller();
        valid_address(&from);
        valid_address(&to);
        not_blacklisted(&from);
        not_blacklisted(&to);
        not_blacklisted(&spender);

        assert!(amount > 0, "Amount must be > 0");

        Lts20::transfer_from(&spender, &from, &to, amount);
    }

    /// Set allowance for a spender
    #[endpoint]
    pub fn approve(spender: Address, amount: u128) {
        Pausable::assert_not_paused();

        let owner = get_caller();
        valid_address(&spender);
        not_blacklisted(&owner);
        not_blacklisted(&spender);

        assert!(owner != spender, "Cannot approve yourself");

        Lts20::approve(&owner, &spender, amount);
    }

    // ─────────────────────────────────────────────
    // MINT & BURN (WITH CUSTOM MINTER/BLACKLIST GUARDS)
    // ─────────────────────────────────────────────

    /// Mint new tokens — accessible by owner or authorized minters
    #[endpoint]
    pub fn mint(to: Address, amount: u128) {
        Pausable::assert_not_paused();

        let caller = get_caller();
        let owner_addr = Ownable::owner().expect("Owner not set");
        let caller_is_minter = storage::read(&key_minter(&caller)).unwrap_or(false);

        assert!(
            caller == owner_addr || caller_is_minter,
            "Access denied: not owner or minter"
        );

        valid_address(&to);
        not_blacklisted(&to);
        assert!(amount > 0, "Mint amount must be > 0");

        let current_supply = Lts20::total_supply();
        assert!(current_supply + amount <= MAX_SUPPLY, "Exceeds max supply cap");

        Lts20::mint(&to, amount);
    }

    /// Burn tokens from the caller's balance
    #[endpoint]
    pub fn burn(amount: u128) {
        Pausable::assert_not_paused();

        let caller = get_caller();
        not_blacklisted(&caller);
        assert!(amount > 0, "Burn amount must be > 0");

        Lts20::burn(&caller, amount);
    }

    // ─────────────────────────────────────────────
    // ADMIN ENDPOINTS (PAUSE, BLACKLIST, OWNERSHIP)
    // ─────────────────────────────────────────────

    #[endpoint]
    pub fn pause() {
        Ownable::assert_only_owner();
        Pausable::set_paused(true);
    }

    #[endpoint]
    pub fn unpause() {
        Ownable::assert_only_owner();
        Pausable::set_paused(false);
    }

    #[endpoint]
    pub fn blacklist(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_blacklist(&account), &true);
        emit_event("Blacklisted", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn unblacklist(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_blacklist(&account), &false);
        emit_event("Unblacklisted", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn add_minter(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_minter(&account), &true);
        emit_event("MinterAdded", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn remove_minter(account: Address) {
        Ownable::assert_only_owner();
        storage::write(&key_minter(&account), &false);
        emit_event("MinterRemoved", &[("account", &account.to_string())]);
    }

    #[endpoint]
    pub fn transfer_ownership(new_owner: Address) {
        // Automatically checks if caller is owner and transfers securely
        Ownable::transfer_ownership(new_owner);
    }
}
`, isSdk: false }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>('lib.rs');
    const [activeSidebarPanel, setActiveSidebarPanel] = useState<'explorer' | 'settings' | 'wallet'>('explorer');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // GitHub SDK Loader State
    const [sdkRepo, setSdkRepo] = useState('boomsatu/sdk-rs');
    const [sdkBranch, setSdkBranch] = useState('main');
    const [isLoadingSdk, setIsLoadingSdk] = useState(false);
    const [sdkFiles, setSdkFiles] = useState<string[]>([]);
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);

    const terminalRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    // Sync tab edits back to tab content state and raw code state
    const updateTabContent = (tabId: string, newContent: string) => {
        if (tabId === 'lib.rs') {
            setCode(newContent);
        }
        setOpenTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, content: newContent } : tab));
    };

    // Load SDK structure from GitHub (or local fallback)
    const handleLoadSdk = async () => {
        setIsLoadingSdk(true);
        addLog(`Fetching SDK directory structure from GitHub [${sdkRepo}@${sdkBranch}]...`, "info");
        try {
            const response = await fetch(`https://api.github.com/repos/${sdkRepo}/contents/src/standards?ref=${sdkBranch}`);
            if (!response.ok) {
                throw new Error("Repository or branch not found");
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                const files = data
                    .filter((item: any) => item.type === 'file' && item.name.endsWith('.rs'))
                    .map((item: any) => `standards/${item.name}`);
                setSdkFiles(files);
                setIsSdkLoaded(true);
                addLog(`Successfully loaded ${files.length} SDK modules from GitHub!`, "success");
            } else {
                throw new Error("Invalid structure returned");
            }
        } catch (e: any) {
            addLog(`Failed to fetch SDK from API. Loading local standards as fallback...`, "tech");
            const fallback = [
                'standards/mod.rs',
                'standards/ownable.rs',
                'standards/pausable.rs',
                'standards/lts20.rs',
                'standards/lts721.rs',
                'standards/lts1155.rs',
                'standards/access_control.rs',
                'standards/reentrancy_guard.rs',
                'standards/safemath.rs',
                'standards/rate_limiter.rs',
                'standards/multisig.rs',
                'standards/timelock.rs',
                'standards/supply_cap.rs',
                'standards/emergency.rs'
            ];
            setSdkFiles(fallback);
            setIsSdkLoaded(true);
            addLog(`Local SDK standards loaded as fallback.`, "success");
        } finally {
            setIsLoadingSdk(false);
        }
    };

    // Load SDK raw file content
    const handleOpenSdkFile = async (filePath: string) => {
        const tabId = `sdk:${filePath}`;
        const exists = openTabs.some(t => t.id === tabId);
        if (exists) {
            setActiveTabId(tabId);
            return;
        }

        addLog(`Fetching SDK module ${filePath} from GitHub...`, "info");
        try {
            const url = `https://cdn.jsdelivr.net/gh/${sdkRepo}@${sdkBranch}/src/${filePath}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("File not found on CDN");
            const fileContent = await res.text();
            
            const fileName = filePath.split('/').pop() || filePath;
            setOpenTabs(prev => [...prev, {
                id: tabId,
                name: `[SDK] ${fileName}`,
                content: fileContent,
                isSdk: true
            }]);
            setActiveTabId(tabId);
            addLog(`Loaded ${fileName} successfully.`, "success");
        } catch (err: any) {
            addLog(`Failed to fetch ${filePath} from GitHub raw. Error: ${err.message}`, "error");
        }
    };

    const addLog = (msg: string, type: 'info' | 'error' | 'success' | 'tech') => {
        setLogs(prev => [...prev, { msg, type }]);
        if (terminalRef.current) {
            setTimeout(() => {
                terminalRef.current!.scrollTop = terminalRef.current!.scrollHeight;
            }, 100);
        }
    };

    const updateBalance = async (addr: string) => {
        if (!window.lumina) return;
        try {
            const balanceRaw = await window.lumina.request({
                method: 'lumina_getBalance',
                params: { address: addr }
            });
            const balanceLUM = parseFloat(balanceRaw) / 1e18;
            setWalletBalance(balanceLUM.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 }));
        } catch (e: any) {
            console.error("Gagal mengambil saldo:", e.message);
        }
    };

    useEffect(() => {
        addLog("Lumina Forge Protocol v1.2 Initialized", "info");
        addLog("WASM Execution Engine: Ready", "tech");

        // Deteksi Extension Wallet otomatis
        const checkProvider = () => {
            if (window.lumina) {
                addLog("Lumina Extension Wallet detected! (window.lumina)", "success");
                const currentAddr = window.lumina.getAddress();
                if (currentAddr) {
                    setWalletAddress(currentAddr);
                    updateBalance(currentAddr);
                    addLog(`Auto-detected active wallet address: ${currentAddr}`, "success");
                }

                // Listen to accounts change
                const handleAccountsChanged = (accounts: any) => {
                    const addr = accounts[0] || null;
                    setWalletAddress(addr);
                    if (addr) {
                        updateBalance(addr);
                        addLog(`Wallet account changed to: ${addr}`, "success");
                    } else {
                        setWalletBalance("0.000000");
                        addLog("Wallet connection disconnected by user.", "error");
                    }
                };

                window.lumina.on('accountsChanged', handleAccountsChanged);
            } else {
                addLog("Wallet extension not detected. Sideload the extension to enable secure deploy!", "info");
            }
        };

        const timer = setTimeout(checkProvider, 600);
        return () => clearTimeout(timer);
    }, []);

    const connectWallet = async () => {
        if (!window.lumina) {
            alert("Lumina Wallet Extension not detected! Please install or sideload the extension.");
            return;
        }
        try {
            addLog("Requesting Lumina Extension connection...", "info");
            const accounts = await window.lumina.request({ method: 'lumina_requestAccounts' });
            const connectedAddr = accounts[0];
            setWalletAddress(connectedAddr);
            updateBalance(connectedAddr);
            addLog(`Connected securely! Wallet Address: ${connectedAddr}`, "success");
        } catch (err: any) {
            addLog(`Connection rejected: ${err.message}`, "error");
        }
    };



    const handleCompile = async () => {
        setIsCompiling(true);
        setIsTerminalVisible(true);
        addLog(`Invoking Local LLVM Compiler [Rust ${compilerVersion}]...`, "info");

        try {
            const compilerUrl = compilerMapping[compilerVersion] || 'http://localhost:9091';
            const res = await fetch(`${compilerUrl}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code, 
                    version: compilerVersion,
                    sdk_repo: isSdkLoaded ? sdkRepo : null,
                    sdk_branch: isSdkLoaded ? sdkBranch : null
                })
            });
            const data = await res.json();

            if (data.status === 'success') {
                addLog(`COMPILATION SUCCESSFUL. WASM generated (${data.wasm.length / 2} bytes)`, "success");

                // MENGGUNAKAN ABI DINAMIS HASIL BEDAH KODE DARI SERVER
                setCompilationArtifacts({
                    bytecode: data.wasm,
                    abi: data.abi
                });
                setIsCompiled(true);

                // Add or update abi.json tab
                const abiString = JSON.stringify(data.abi, null, 2);
                setOpenTabs(prev => {
                    const exists = prev.some(t => t.id === 'abi.json');
                    if (exists) {
                        return prev.map(t => t.id === 'abi.json' ? { ...t, content: abiString } : t);
                    } else {
                        return [...prev, { id: 'abi.json', name: 'abi.json', content: abiString, isSdk: false }];
                    }
                });
                setActiveTabId('abi.json');
            } else {
                addLog(`COMPILATION FAILED: ${data.error}`, "error");
            }
        } catch (err) {
            addLog("COMPILER OFFLINE: Run 'cargo run --manifest-path compiler-service/Cargo.toml'", "error");
        } finally {
            setIsCompiling(false);
        }
    };

    const handleDeploy = async () => {
        if (!walletAddress && !privKey) {
            alert("Harap masukkan Deployer Secret atau hubungkan Dompet Ekstensi!");
            return;
        }
        if (!compilationArtifacts) return;
        setIsDeploying(true);
        setIsTerminalVisible(true);
        addLog("Initiating Secure Network Broadcast...", "info");

        try {
            // Build the dynamic bytecode + custom section payload
            const bytecodeBytes = new Uint8Array(compilationArtifacts.bytecode.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // --- INJECT ABI INTO WASM CUSTOM SECTION (Code-as-Truth) ---
            const abiString = JSON.stringify(compilationArtifacts.abi);
            const abiData = new TextEncoder().encode(abiString);
            const sectionName = "lumina_abi";
            const nameData = new TextEncoder().encode(sectionName);

            const encodeVarUint = (val: number) => {
                const res = [];
                while (val > 0x7f) {
                    res.push((val & 0x7f) | 0x80);
                    val >>= 7;
                }
                res.push(val);
                return new Uint8Array(res);
            };

            const nameLen = encodeVarUint(nameData.length);
            const totalSize = encodeVarUint(nameLen.length + nameData.length + abiData.length);

            const customSection = new Uint8Array(1 + totalSize.length + nameLen.length + nameData.length + abiData.length);
            let offset = 0;
            customSection[offset++] = 0; // Section ID: 0 (Custom)
            customSection.set(totalSize, offset); offset += totalSize.length;
            customSection.set(nameLen, offset); offset += nameLen.length;
            customSection.set(nameData, offset); offset += nameData.length;
            customSection.set(abiData, offset);

            const enrichedBytecode = new Uint8Array(bytecodeBytes.length + customSection.length);
            enrichedBytecode.set(bytecodeBytes);
            enrichedBytecode.set(customSection, bytecodeBytes.length);

            console.log(`Code-as-Truth: ABI Injected into WASM (${abiData.length} bytes)`);

            // Sign Transaction with original DEPLOY prefix
            const prefix = new TextEncoder().encode("DEPLOY:");
            const fullPayload = new Uint8Array(prefix.length + enrichedBytecode.length);
            fullPayload.set(prefix);
            fullPayload.set(enrichedBytecode, prefix.length);

            // JIKA MENGGUNAKAN WALLET EXTENSION CHROME
            if (walletAddress && window.lumina) {
                addLog("Initiating Secure Sideloaded Extension Transaction Signature...", "info");
                try {
                    addLog("Broadcasting transaction through Chrome Extension Wallet...", "tech");
                    const resultHash = await window.lumina.request({
                        method: 'lumina_sendTransaction',
                        params: {
                            to: "lumina1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4fdvjl",
                            amount: "0",
                            data: Array.from(fullPayload)
                        }
                    });

                    addLog(`📡 Broadcast Success via Extension. Hash: 0x${resultHash.substring(0, 16)}...`, "info");
                    addLog(`⏳ Waiting for block confirmation...`, "info");

                    // Polling Status Transaksi
                    let confirmed = false;
                    let attempts = 0;
                    const client = new LuminaClient('https://rpc1.bariscode.my.id');
                    while (!confirmed && attempts < 20) { // Max 40 detik
                        await new Promise(r => setTimeout(r, 2000));
                        const txStatus = await client.getTransaction(resultHash);

                        if (txStatus && txStatus.status) {
                            const statusUpper = txStatus.status.toUpperCase();
                            if (statusUpper.includes("SUCCESS") || statusUpper.includes("CONFIRMED")) {
                                const finalAddr = toLuminaAddress(resultHash);
                                addLog(`✓ DEPLOYMENT FINALIZED!`, "success");
                                addLog(`Contract Live at: ${finalAddr}`, "success");
                                setContractId(finalAddr);
                                confirmed = true;
                            } else if (statusUpper.includes("FAILED")) {
                                addLog(`✖ DEPLOYMENT FAILED: ${txStatus.status}`, "error");
                                confirmed = true;
                            }
                        }
                        attempts++;
                    }
                    if (!confirmed) {
                        addLog("WARNING: Transaction broadcasted but confirmation timed out. It might be mined later.", "error");
                    }
                } catch (e: any) {
                    addLog(`✖ Deployment cancelled or failed: ${e.message}`, "error");
                } finally {
                    setIsDeploying(false);
                }
                return;
            }

            // FALLBACK: JIKA MENGGUNAKAN PRIVATE KEY MANUAL
            // EKSTRAK HANYA HEX-NYA SAJA (Toleran kalau Sultan copy sebaris penuh)
            const rawInput = (privKey || "").toString();
            const hexMatch = rawInput.match(/[0-9a-fA-F]{64}/);
            const cleanPrivKey = hexMatch ? hexMatch[0] : rawInput.replace(/^0x/, '');

            console.log("Clean PrivKey:", cleanPrivKey ? "SET (64 chars)" : "EMPTY");

            const wallet = new LuminaWallet(cleanPrivKey);
            const client = new LuminaClient('https://rpc1.bariscode.my.id');

            const walletAddr = wallet.getAddress();
            let nextNonce = 0;
            try {
                const state = await client.getBalance(walletAddr);
                nextNonce = state.next_nonce || 0;
                addLog(`Deployer Nonce: ${nextNonce}`, "tech");
            } catch (e: any) {
                addLog(`WARNING: Failed to fetch nonce. Defaulting to 0. Error: ${e.message}`, "tech");
            }

            // 1. Ambil Fee Dinamis dari SDK (Wajib dari Node!)
            addLog("Calculating dynamic network fee via SDK...", "tech");
            let finalFee: bigint;
            try {
                const feeStr = await client.estimateFee(fullPayload);
                finalFee = BigInt(feeStr);
                const formattedFee = (Number(finalFee) / 1e18).toFixed(8);
                addLog(`Dynamic Fee Calculated: ${formattedFee} LUM`, "tech");
            } catch (e: any) {
                addLog(`CRITICAL ERROR: Failed to estimate network fee. Node might be offline or size exceeds limit.`, "error");
                setIsDeploying(false);
                return;
            }

            // Gunakan limit dari input UI (Konversi dari LUM ke Units)
            let userLimit = BigInt(0);
            try {
                userLimit = BigInt(LuminaUtils.toUnits(gasLimit || "0").toString());
            } catch (e) {
                addLog("ERROR: Format Gas Limit tidak valid (harus angka desimal, misal: 0.001)", "error");
                setIsDeploying(false);
                return;
            }

            if (finalFee > userLimit) {
                addLog(`ERROR: Fee (${(Number(finalFee) / 1e18).toFixed(8)} LUM) melebihi jatah Gas Limit Anda (${(Number(userLimit) / 1e18).toFixed(8)} LUM).`, "error");
                setIsDeploying(false);
                return;
            }

            const tx = wallet.signTransaction(
                "lumina1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4fdvjl",
                0,
                nextNonce,
                Array.from(fullPayload),
                null,
                finalFee // Kirim sebagai BigInt agar tidak dikalikan 10^18 lagi oleh SDK
            );
            console.log("TX Signed Successfully with Fee:", finalFee.toString());

            const result = await client.sendTransaction(tx, { wait: false });
            console.log("Broadcast Result:", result);

            if (result && (result.status === 'ok' || result.status === 'success')) {
                const txHash = typeof result.hash === 'string' ? result.hash : toLuminaAddress(result.hash);
                const rawHash = txHash.includes(':') ? txHash.split(':')[2] : txHash;

                addLog(`📡 Broadcast Success. Hash: 0x${rawHash.substring(0, 16)}...`, "info");
                addLog(`⏳ Waiting for block confirmation...`, "info");

                // Polling Status Transaksi
                let confirmed = false;
                let attempts = 0;
                while (!confirmed && attempts < 20) { // Max 40 detik
                    await new Promise(r => setTimeout(r, 2000));
                    const txStatus = await client.getTransaction(rawHash);

                    if (txStatus && txStatus.status) {
                        const statusUpper = txStatus.status.toUpperCase();
                        if (statusUpper.includes("SUCCESS") || statusUpper.includes("CONFIRMED")) {
                            const finalAddr = toLuminaAddress(rawHash);
                            addLog(`✓ DEPLOYMENT FINALIZED!`, "success");
                            addLog(`Contract Live at: ${finalAddr}`, "success");
                            setContractId(finalAddr);
                            confirmed = true;
                        } else if (statusUpper.includes("FAILED")) {
                            addLog(`✖ DEPLOYMENT FAILED: ${txStatus.status}`, "error");
                            confirmed = true;
                        }
                    }
                    attempts++;
                }

                if (!confirmed) {
                    addLog(`⚠ Confirmation timeout. Check Explorer for hash: 0x${rawHash}`, "tech");
                }
            } else {
                addLog(`REJECTED: ${result?.message || 'Unknown node error'}`, "error");
            }
        } catch (err: any) {
            addLog(`BROADCAST ERROR: ${err.message}`, "error");
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
            <header className="h-14 border-b border-white/5 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 z-20 flex-shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center">
                            <Binary className="text-emerald-500" size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black tracking-[0.3em] uppercase">Lumina Forge</span>
                            <span className="text-[9px] text-white/30 uppercase tracking-widest">Compiler Studio v1.2</span>
                        </div>
                    </div>
                    <div className="h-6 w-[1px] bg-white/5"></div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] text-emerald-500/80 uppercase tracking-tighter">Mainnet-Alpha-1</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    {/* Compiler Version Selector */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded border border-white/10 group hover:border-emerald-500/30 transition-all">
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Compiler</span>
                        <select
                            value={compilerVersion}
                            onChange={(e) => setCompilerVersion(e.target.value)}
                            className="bg-transparent text-[10px] font-mono text-emerald-500 outline-none cursor-pointer"
                        >
                            {rustVersions.map(v => (
                                <option key={v} value={v} className="bg-black text-white">compiler [{v}]</option>
                            ))}
                        </select>
                    </div>

                    {/* Wallet Connection Status */}
                    {walletAddress ? (
                        <button
                            onClick={() => {
                                setActiveSidebarPanel('wallet');
                                setIsSidebarOpen(true);
                            }}
                            className="h-9 px-4 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded flex items-center gap-2 text-[10px] font-mono text-emerald-400 transition-all cursor-pointer"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span>{walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 4)}</span>
                            <span className="text-white/20">|</span>
                            <span className="font-bold text-white">{walletBalance} LUM</span>
                        </button>
                    ) : (
                        <button
                            onClick={connectWallet}
                            className="h-9 px-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded border border-emerald-500/25 text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        >
                            Connect Wallet
                        </button>
                    )}

                    <button
                        onClick={handleCompile}
                        disabled={isCompiling || isDeploying}
                        className="h-9 px-5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-20"
                    >
                        {isCompiling ? <Activity className="animate-spin text-emerald-500" size={14} /> : <Zap className="text-emerald-500" size={14} />}
                        Compile
                    </button>
                    <button
                        onClick={handleDeploy}
                        disabled={!isCompiled || isDeploying}
                        className={cn(
                            "h-9 px-5 border rounded transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
                            isCompiled ? "border-emerald-500 bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-white/5 text-white/20 cursor-not-allowed"
                        )}
                    >
                        {isDeploying ? <Activity className="animate-spin" size={14} /> : <Plus size={14} />}
                        Deploy
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* 1. IDE Sidebar Navigation Rail */}
                <div className="w-14 bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-6 space-y-6 flex-shrink-0 z-10">
                    <button
                        onClick={() => {
                            if (activeSidebarPanel === 'explorer') {
                                setIsSidebarOpen(!isSidebarOpen);
                            } else {
                                setActiveSidebarPanel('explorer');
                                setIsSidebarOpen(true);
                            }
                        }}
                        className={cn(
                            "w-10 h-10 rounded flex items-center justify-center transition-all hover:bg-white/5",
                            isSidebarOpen && activeSidebarPanel === 'explorer' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-white/40"
                        )}
                        title="File Explorer"
                    >
                        <Code size={20} />
                    </button>
                    <button
                        onClick={() => {
                            if (activeSidebarPanel === 'settings') {
                                setIsSidebarOpen(!isSidebarOpen);
                            } else {
                                setActiveSidebarPanel('settings');
                                setIsSidebarOpen(true);
                            }
                        }}
                        className={cn(
                            "w-10 h-10 rounded flex items-center justify-center transition-all hover:bg-white/5",
                            isSidebarOpen && activeSidebarPanel === 'settings' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-white/40"
                        )}
                        title="Compiler Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => {
                            if (activeSidebarPanel === 'wallet') {
                                setIsSidebarOpen(!isSidebarOpen);
                            } else {
                                setActiveSidebarPanel('wallet');
                                setIsSidebarOpen(true);
                            }
                        }}
                        className={cn(
                            "w-10 h-10 rounded flex items-center justify-center transition-all hover:bg-white/5",
                            isSidebarOpen && activeSidebarPanel === 'wallet' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-white/40"
                        )}
                        title="Wallet & Credentials"
                    >
                        <ShieldCheck size={20} />
                    </button>
                </div>

                {/* 2. Expandable Sidebar Panel */}
                {isSidebarOpen && (
                    <aside className="w-72 border-r border-white/5 bg-[#080808] flex flex-col p-6 space-y-8 overflow-y-auto flex-shrink-0">
                        {activeSidebarPanel === 'explorer' && (
                            <div className="flex-1 flex flex-col space-y-6 min-h-0">
                                {/* WORKSPACE SECTION */}
                                <div className="space-y-3 flex-shrink-0">
                                    <div className="flex items-center justify-between text-white/40 border-b border-white/5 pb-2 text-[9px] uppercase font-black tracking-widest">
                                        <span>Workspace Files</span>
                                        <Code size={12} />
                                    </div>
                                    <div className="space-y-1">
                                        <button
                                            onClick={() => setActiveTabId('lib.rs')}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2.5 transition-all font-mono",
                                                activeTabId === 'lib.rs' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <Code size={14} className="text-emerald-500" />
                                            lib.rs
                                        </button>
                                        {isCompiled && (
                                            <button
                                                onClick={() => setActiveTabId('abi.json')}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2.5 transition-all font-mono",
                                                    activeTabId === 'abi.json' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                                                )}
                                            >
                                                <Box size={14} className="text-amber-500" />
                                                abi.json
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* GITHUB SDK LOADER SECTION */}
                                <div className="space-y-4 flex flex-col flex-1 min-h-0">
                                    <div className="flex items-center justify-between text-white/40 border-b border-white/5 pb-2 text-[9px] uppercase font-black tracking-widest flex-shrink-0">
                                        <span>Lumina SDK (GitHub)</span>
                                        <ShieldCheck size={12} />
                                    </div>

                                    {/* Config inputs */}
                                    <div className="space-y-3 bg-white/5 p-3.5 border border-white/5 rounded flex-shrink-0">
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Repository</label>
                                            <input
                                                type="text"
                                                value={sdkRepo}
                                                onChange={(e) => setSdkRepo(e.target.value)}
                                                className="w-full bg-black border border-white/10 px-2 py-1.5 text-xs text-slate-300 font-mono rounded outline-none focus:border-emerald-500/30 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Branch / Tag</label>
                                            <input
                                                type="text"
                                                value={sdkBranch}
                                                onChange={(e) => setSdkBranch(e.target.value)}
                                                className="w-full bg-black border border-white/10 px-2 py-1.5 text-xs text-slate-300 font-mono rounded outline-none focus:border-emerald-500/30 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={handleLoadSdk}
                                            disabled={isLoadingSdk}
                                            className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                                        >
                                            {isLoadingSdk ? <Activity size={12} className="animate-spin text-emerald-400" /> : <RefreshCw size={12} />}
                                            {isLoadingSdk ? "Loading..." : "Load SDK"}
                                        </button>
                                    </div>

                                    {/* SDK file list */}
                                    {isSdkLoaded ? (
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] min-h-0">
                                            <div className="text-[9px] text-white/20 uppercase tracking-widest px-2 mb-2 font-bold">Standards Library</div>
                                            {sdkFiles.map(file => {
                                                const tabId = `sdk:${file}`;
                                                const isActive = activeTabId === tabId;
                                                const fileName = file.split('/').pop() || file;
                                                return (
                                                    <button
                                                        key={file}
                                                        onClick={() => handleOpenSdkFile(file)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-1.5 rounded flex items-center gap-2 transition-all",
                                                            isActive ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-white/50 hover:bg-white/5 hover:text-white"
                                                        )}
                                                    >
                                                        <Code size={12} className="text-cyan-500" />
                                                        {fileName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-white/5 rounded text-center">
                                            <ShieldCheck size={28} className="text-white/10 mb-2" />
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">SDK Not Loaded</p>
                                            <p className="text-[9px] text-white/20 mt-1 max-w-[180px]">Load the standard library modules from GitHub above.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeSidebarPanel === 'settings' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between text-white/40 border-b border-white/5 pb-2 text-[9px] uppercase font-black tracking-widest">
                                    <span>Compiler Options</span>
                                    <Settings size={12} />
                                </div>
                                <div className="group">
                                    <label className="text-[9px] text-white/20 uppercase tracking-widest block mb-1.5 group-focus-within:text-emerald-500 transition-colors">Rust Version</label>
                                    <select value={compilerVersion} onChange={(e) => setCompilerVersion(e.target.value)} className="w-full bg-black/50 border border-white/5 px-3 py-2.5 text-xs focus:border-emerald-500/30 outline-none transition-all rounded">
                                        {rustVersions.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="group">
                                    <label className="text-[9px] text-white/20 uppercase tracking-widest block mb-1.5 group-focus-within:text-emerald-500 transition-colors">Max Fee Limit (LUM)</label>
                                    <input type="text" value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} className="w-full bg-black/50 border border-white/5 px-3 py-2.5 text-xs focus:border-emerald-500/30 outline-none transition-all rounded font-mono" placeholder="0.001" />
                                </div>
                            </div>
                        )}

                        {activeSidebarPanel === 'wallet' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between text-white/40 border-b border-white/5 pb-2 text-[9px] uppercase font-black tracking-widest">
                                    <span>Authentication</span>
                                    <ShieldCheck size={12} />
                                </div>
                                {walletAddress ? (
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[9px] text-emerald-500 uppercase tracking-widest block font-bold">Extension Connected</label>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        </div>
                                        <span className="font-mono text-[10px] text-slate-300 break-all block">{walletAddress}</span>
                                        <div className="flex justify-between items-baseline pt-1">
                                            <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Wallet Balance</span>
                                            <span className="font-mono text-xs font-black text-emerald-400">{walletBalance} LUM</span>
                                        </div>
                                        <button onClick={connectWallet} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] uppercase tracking-wider py-2 rounded transition-all">Reconnect</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button onClick={connectWallet} className="w-full bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all hover:bg-emerald-400">Connect Wallet</button>
                                        <div className="group">
                                            <label className="text-[9px] text-white/20 uppercase tracking-widest block mb-1.5 group-focus-within:text-red-500 transition-colors">Deployer Secret (Fallback)</label>
                                            <input type="password" value={privKey} onChange={(e) => setPrivKey(e.target.value)} className="w-full bg-black/50 border border-white/5 px-3 py-2.5 text-xs focus:border-red-500/20 outline-none transition-all rounded font-mono" placeholder="HEX KEY" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </aside>
                )}

                {/* 3. Editor Tab & Code Area */}
                <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
                    {/* Tab Bar */}
                    <div className="flex bg-[#0a0a0a] border-b border-white/5 h-9 overflow-x-auto scrollbar-none flex-shrink-0">
                        {openTabs.map(tab => {
                            const isActive = tab.id === activeTabId;
                            return (
                                <div
                                    key={tab.id}
                                    className={cn(
                                        "flex items-center border-r border-white/5 transition-all",
                                        isActive ? "bg-[#050505]" : "hover:bg-white/5"
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveTabId(tab.id)}
                                        className={cn(
                                            "px-4 py-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] font-sans font-bold",
                                            isActive ? (tab.isSdk ? "text-cyan-400" : tab.id === 'abi.json' ? "text-amber-500" : "text-emerald-500") : "text-white/30"
                                        )}
                                    >
                                        {tab.isSdk ? <ShieldCheck size={12} className="text-cyan-500" /> : tab.id === 'abi.json' ? <Box size={12} /> : <Code size={12} />}
                                        {tab.name}
                                    </button>
                                    {tab.id !== 'lib.rs' && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenTabs(prev => prev.filter(t => t.id !== tab.id));
                                                if (activeTabId === tab.id) {
                                                    setActiveTabId('lib.rs');
                                                }
                                            }}
                                            className="pr-3 text-white/20 hover:text-white/60 transition-colors"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex-1 relative bg-[#050505] min-h-0 overflow-hidden">
                        <Editor
                            height="100%"
                            path={activeTabId}
                            language={
                                activeTabId.endsWith('.json') || activeTabId === 'abi.json' ? "json" : "rust"
                            }
                            theme="vs-dark"
                            value={
                                activeTabId === 'lib.rs'
                                    ? code
                                    : openTabs.find(t => t.id === activeTabId)?.content || ""
                            }
                            onMount={handleEditorDidMount}
                            onChange={(v) => {
                                if (!editorRef.current) return;
                                const model = editorRef.current.getModel();
                                if (!model) return;
                                const uriPath = model.uri.path;
                                // Only sync if the change actually occurred in lib.rs model to prevent overwriting during tab transitions
                                if (uriPath.endsWith('/lib.rs') || uriPath === 'lib.rs') {
                                    setCode(v || '');
                                    setOpenTabs(prev => prev.map(t => t.id === 'lib.rs' ? { ...t, content: v || '' } : t));
                                }
                            }}
                            options={{
                                fontSize: 13,
                                fontFamily: "'JetBrains Mono', monospace",
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 20 },
                                renderLineHighlight: 'all',
                                readOnly: activeTabId === 'abi.json' || activeTabId.startsWith('sdk:'),
                                hideCursorInOverviewRuler: true,
                                scrollbar: { vertical: 'hidden', horizontal: 'hidden' }
                            }}
                        />
                    </div>

                    <div className={cn("border-t border-white/5 flex flex-col bg-[#050505] transition-all duration-300 flex-shrink-0 relative z-10 overflow-hidden", isTerminalVisible ? "h-64" : "h-8")}>
                        <div onClick={() => setIsTerminalVisible(!isTerminalVisible)} className="h-8 bg-[#0a0a0a] flex items-center justify-between px-4 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <TerminalIcon size={12} className={isTerminalVisible ? "text-emerald-500" : "text-white/20"} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Consolidated System Output</span>
                            </div>
                            <div className="flex items-center gap-4">
                                {isCompiled && (
                                    <div className="flex items-center gap-4 mr-4 border-r border-white/10 pr-4">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveTabId('abi.json');
                                            }}
                                            className="text-[8px] font-black uppercase text-teal-400 hover:text-white transition-colors flex items-center gap-1.5"
                                        >
                                            <Box size={10} /> ABI JSON
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // TODO: Show bytecode modal or tab
                                            }}
                                            className="text-[8px] font-black uppercase text-amber-400 hover:text-white transition-colors flex items-center gap-1.5"
                                        >
                                            <Cpu size={10} /> Bytecode
                                        </button>
                                    </div>
                                )}
                                {isTerminalVisible ? <ChevronDown size={14} className="text-white/20" /> : <ChevronUp size={14} className="text-white/20" />}
                            </div>
                        </div>
                        <div ref={terminalRef} className={cn("flex-1 p-5 font-mono text-[11px] overflow-y-auto space-y-1.5 selection:bg-emerald-500/20", !isTerminalVisible && "hidden")}>
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <span className="text-white/10 w-8 select-none italic">[{i.toString().padStart(3, '0')}]</span>
                                    <span className={cn(
                                        log.type === 'error' ? 'text-red-500' :
                                            log.type === 'success' ? 'text-emerald-400 font-bold' :
                                                log.type === 'tech' ? 'text-white/20 font-light' : 'text-blue-400/80'
                                    )}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {contractId && (
                        <div className="absolute top-10 right-10 w-[420px] bg-black/90 border border-emerald-500/30 p-6 shadow-[0_0_50px_rgba(16,185,129,0.2)] rounded backdrop-blur-2xl animate-in fade-in slide-in-from-right duration-500 z-30">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3 text-emerald-500">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-black uppercase tracking-[0.2em]">Deployment Verified</span>
                                        <span className="text-[8px] text-white/30 uppercase tracking-widest">Protocol LTS-20 Standard</span>
                                    </div>
                                </div>
                                <button onClick={() => setContractId('')} className="text-white/20 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 mb-6 rounded relative group overflow-hidden">
                                <p className="text-[9px] text-white/20 uppercase mb-2 font-bold tracking-[0.3em]">Contract Address</p>
                                <p className="text-[13px] font-mono text-emerald-400 break-all leading-relaxed select-all">
                                    {contractId}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black h-12 flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] transition-all rounded shadow-[0_4px_15_rgba(16,185,129,0.4)]">
                                    Interact with Engine
                                </button>
                                <button className="w-12 h-12 border border-white/10 hover:bg-white/5 flex items-center justify-center transition-all rounded">
                                    <Maximize2 size={18} className="text-white/40" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
