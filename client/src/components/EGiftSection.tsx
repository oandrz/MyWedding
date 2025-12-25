import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { fadeIn, staggerContainer } from "@/lib/animations";

interface BankAccount {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
}

interface BankAccountCardProps {
  account: BankAccount;
  label: string;
  index: number;
  copiedAccount: string | null;
  onCopy: (accountNumber: string, accountHolder: string) => void;
}

// TOP-LEVEL component - uses whileInView for reliable scroll-triggered animations
const BankAccountCard = ({
  account,
  label,
  index,
  copiedAccount,
  onCopy
}: BankAccountCardProps) => (
  <motion.div
    className="glass-card rounded-2xl p-8 text-center"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.1 }}
    transition={{ duration: 0.6, delay: index * 0.2, ease: "easeOut" }}
  >
    <p className="text-sm text-muted-foreground font-montserrat mb-2 uppercase tracking-wider">{label}</p>
    <h3 className="text-2xl font-cormorant font-semibold mb-3 text-primary">
      {account.accountHolder}
    </h3>
    <p className="text-sm font-montserrat text-muted-foreground uppercase tracking-wider mb-1">
      {account.bankName}
    </p>
    <p className="text-2xl font-montserrat font-medium text-foreground mb-6 tracking-wider">
      {account.accountNumber}
    </p>
    <motion.button
      onClick={() => onCopy(account.accountNumber, account.accountHolder)}
      className="bg-primary px-6 py-3 text-white font-montserrat uppercase tracking-wider text-sm rounded-lg shadow-lg hover:bg-opacity-90 transition-all duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      data-testid={`copy-${label.toLowerCase().replace(/\s+/g, '-')}-account`}
    >
      {copiedAccount === account.accountNumber ? (
        <>
          <Check className="h-4 w-4 mr-2 inline" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-2 inline" />
          Copy Account Number
        </>
      )}
    </motion.button>
  </motion.div>
);

const EGiftSection = () => {
  const { toast } = useToast();
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const { data: settingsData, isLoading } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  const getSettingValue = (key: string, defaultValue: string): string => {
    const setting = settingsData?.settings?.find(s => s.settingKey === key);
    return setting?.settingValue || defaultValue;
  };

  const groomAccount: BankAccount = {
    accountHolder: getSettingValue("egift_groom_name", "Andreas"),
    bankName: getSettingValue("egift_groom_bank", "Bank BCA"),
    accountNumber: getSettingValue("egift_groom_account", "1234567890"),
  };

  const brideAccount: BankAccount = {
    accountHolder: getSettingValue("egift_bride_name", "Christine"),
    bankName: getSettingValue("egift_bride_bank", "Bank BCA"),
    accountNumber: getSettingValue("egift_bride_account", "0987654321"),
  };

  const handleCopyAccount = async (accountNumber: string, accountHolder: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(accountNumber);
      toast({
        title: "Copied!",
        description: `Account number for ${accountHolder} copied to clipboard`,
      });
      setTimeout(() => setCopiedAccount(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the account number manually",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <section id="e-gift" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Gift className="h-10 w-10 mx-auto text-primary mb-4 animate-pulse" />
            <p className="text-muted-foreground font-montserrat">Loading gift information...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="e-gift"
      className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture"
    >
      <div className="container mx-auto px-4">
        {/* Title section with whileInView */}
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn}>
            <Gift className="h-10 w-10 mx-auto text-primary mb-4" />
          </motion.div>

          <motion.h2
            className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
            variants={fadeIn}
          >
            Wedding Gift
          </motion.h2>

          <motion.div
            className="w-24 h-1 mx-auto mb-6 rounded-full bg-primary"
            variants={fadeIn}
          ></motion.div>

          <motion.p
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Your kind blessing can be sent to the information below
          </motion.p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <BankAccountCard
            account={groomAccount}
            label="a.n"
            index={0}
            copiedAccount={copiedAccount}
            onCopy={handleCopyAccount}
          />
          <BankAccountCard
            account={brideAccount}
            label="a.n"
            index={1}
            copiedAccount={copiedAccount}
            onCopy={handleCopyAccount}
          />
        </div>
      </div>
    </section>
  );
};

export default EGiftSection;
