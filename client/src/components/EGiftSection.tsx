import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BankAccount {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
}

interface EGiftSettings {
  groomAccount: BankAccount;
  brideAccount: BankAccount;
}

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

  if (isLoading) {
    return (
      <section id="e-gift" className="py-16 md:py-24 bg-[#f5f1eb]">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Gift className="h-10 w-10 mx-auto text-[#8b7355] mb-4 animate-pulse" />
            <p className="text-gray-500 font-montserrat">Loading gift information...</p>
          </div>
        </div>
      </section>
    );
  }

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

  const BankAccountCard = ({ account, label }: { account: BankAccount; label: string }) => (
    <Card className="bg-white/80 backdrop-blur-sm border-none shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-6 text-center">
        <p className="text-sm text-gray-500 font-montserrat mb-2">{label}</p>
        <h3 className="text-xl font-cormorant font-semibold text-[#8b7355] mb-3">
          {account.accountHolder}
        </h3>
        <p className="text-sm font-montserrat text-gray-600 uppercase tracking-wider mb-1">
          {account.bankName}
        </p>
        <p className="text-2xl font-montserrat font-medium text-gray-800 mb-4 tracking-wider">
          {account.accountNumber}
        </p>
        <Button
          onClick={() => handleCopyAccount(account.accountNumber, account.accountHolder)}
          className="hover:bg-[#6d5a43] text-white font-montserrat text-sm px-6 bg-[#dba9a9]"
          data-testid={`copy-${label.toLowerCase().replace(/\s+/g, '-')}-account`}
        >
          {copiedAccount === account.accountNumber ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Account Number
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <section
      id="e-gift"
      className="py-16 md:py-24 bg-[#f5f1eb]"
    >
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <div className="mb-4">
            <Gift className="h-10 w-10 mx-auto text-[#8b7355] mb-4" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-cormorant text-[#8b7355] mb-4">
            Wedding Gift
          </h2>
          
          <p className="text-gray-600 font-montserrat mb-12">
            Your kind blessing can be sent to the information below
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <BankAccountCard account={groomAccount} label="a.n" />
            <BankAccountCard account={brideAccount} label="a.n" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default EGiftSection;
