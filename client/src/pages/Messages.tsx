import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Heart, Send, Users, Sparkles } from 'lucide-react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { useMessagesEnabled } from '@/hooks/useFeatureFlags';

// Animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

// Form validation schema
const messageSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  content: z.string().min(3, "Message must be at least 3 characters").max(500, "Message cannot exceed 500 characters")
});

type MessageFormValues = z.infer<typeof messageSchema>;

// Message type definition
interface Message {
  id: number;
  name: string;
  email: string;
  content: string;
  created_at: string;
}

// Function to get initials from a name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const Messages = () => {
  const isMessagesEnabled = useMessagesEnabled();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'form'>('messages');

  // If messages feature is disabled, show a message
  if (!isMessagesEnabled) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="container mx-auto px-4 py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-cormorant text-foreground mb-4">
              Messages Currently Unavailable
            </h1>
            <p className="text-muted-foreground font-montserrat">
              The message board feature is temporarily disabled.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const headerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  const isHeaderInView = useInView(headerRef, { once: true, amount: 0.3 });
  const isMessagesInView = useInView(messagesRef, { once: false, amount: 0.2 });
  const isFormInView = useInView(formRef, { once: false, amount: 0.3 });
  
  const { toast } = useToast();

  // Form setup
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      name: "",
      email: "",
      content: ""
    }
  });

  // Query to fetch messages
  const { 
    data = { messages: [], count: 0 }, 
    isLoading, 
    isError 
  } = useQuery<{ messages: Message[], count: number }>({ 
    queryKey: ['/api/messages'],
  });

  // Mutation to submit a new message
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: MessageFormValues) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Message Submitted",
        description: "Your message has been added to the wall!",
        variant: "default"
      });
      
      // Reset form and refetch messages
      reset();
      setTimeout(() => {
        setIsSubmitted(false);
        setActiveTab('messages'); // Switch to messages tab after submission
      }, 3000);
      
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (error) => {
      console.error("Message submission error:", error);
      toast({
        title: "Error",
        description: `Failed to submit message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: MessageFormValues) => {
    mutate(data);
  };

  // Format the date to a relative time (e.g., "2 hours ago")
  const formatMessageDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background"
        ref={headerRef}
      >
        <div className="container mx-auto px-4">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            animate={isHeaderInView ? "visible" : "hidden"}
            variants={staggerContainer}
          >
            <motion.h1 
              className="text-5xl md:text-6xl font-cormorant text-foreground mb-4"
              variants={fadeIn}
            >
              Message Wall
            </motion.h1>
            <motion.div 
              className="w-24 h-0.5 bg-primary mx-auto mb-6"
              variants={fadeIn}
            ></motion.div>
            <motion.p 
              className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto mb-10"
              variants={fadeIn}
            >
              Share your congratulations, memories, and well-wishes for the couple. Your messages will be treasured forever.
            </motion.p>
            
            {/* Tab Navigation */}
            <motion.div 
              className="flex justify-center space-x-4 mb-8"
              variants={fadeUp}
            >
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex items-center px-6 py-3 rounded-full font-montserrat text-sm transition-all duration-300 ${
                  activeTab === 'messages' 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                View Messages
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center px-6 py-3 rounded-full font-montserrat text-sm transition-all duration-300 ${
                  activeTab === 'form' 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                <Send className="w-4 h-4 mr-2" />
                Add Message
              </button>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-1/2 left-5 md:left-10 transform -translate-y-1/2 opacity-10">
          <Heart className="w-16 h-16 md:w-24 md:h-24 text-primary" />
        </div>
        <div className="absolute top-1/4 right-5 md:right-10 opacity-10">
          <Users className="w-16 h-16 md:w-20 md:h-20 text-primary" />
        </div>
        <div className="absolute bottom-10 left-1/4 opacity-10">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-10">
        {activeTab === 'messages' ? (
          /* Messages Display */
          <motion.div 
            className="max-w-5xl mx-auto"
            ref={messagesRef}
            initial="hidden"
            animate={isMessagesInView ? "visible" : "hidden"}
            variants={staggerContainer}
          >
            <motion.div 
              className="text-center mb-10"
              variants={fadeIn}
            >
              <h2 className="text-3xl font-cormorant text-foreground mb-2">Messages from Loved Ones</h2>
              <p className="text-muted-foreground">{data.count} {data.count === 1 ? 'message' : 'messages'} and counting</p>
            </motion.div>
            
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <Card className="h-full">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-24 bg-primary/10 rounded"></div>
                            <div className="h-3 w-16 bg-muted rounded"></div>
                            <div className="h-20 w-full bg-muted rounded"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
            
            {isError && (
              <div className="text-center p-8 bg-destructive/10 rounded-lg">
                <MessageCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-cormorant text-foreground mb-2">Oops! Something went wrong</h3>
                <p className="text-muted-foreground">
                  We couldn't load the messages. Please try again later.
                </p>
              </div>
            )}
            
            {!isLoading && !isError && data.messages.length === 0 && (
              <div className="text-center p-16 bg-muted/20 rounded-lg shadow-sm">
                <MessageCircle className="h-16 w-16 text-primary/50 mx-auto mb-4" />
                <h3 className="text-2xl font-cormorant text-foreground mb-3">No Messages Yet</h3>
                <p className="text-muted-foreground text-lg mb-8">
                  Be the first to leave a message for the couple!
                </p>
                <button
                  onClick={() => setActiveTab('form')}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-sm font-montserrat text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
                >
                  Add Your Message
                </button>
              </div>
            )}
            
            {!isLoading && !isError && data.messages.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.messages.map((message, index) => (
                    <motion.div 
                      key={message.id}
                      variants={scaleIn}
                      custom={index}
                    >
                      <Card className="h-full overflow-hidden hover:shadow-md transition-shadow duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar className="h-10 w-10 mt-1 bg-primary/10 text-primary">
                              <AvatarFallback>{getInitials(message.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1.5">
                              <div className="flex justify-between items-start">
                                <p className="font-montserrat text-foreground font-medium text-sm">
                                  {message.name}
                                </p>
                                <span className="text-muted-foreground text-xs">
                                  {formatMessageDate(message.created_at)}
                                </span>
                              </div>
                              <p className="text-muted-foreground font-montserrat text-sm whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                
                <div className="text-center mt-12">
                  <button
                    onClick={() => setActiveTab('form')}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-sm font-montserrat text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
                  >
                    Add Your Message
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          /* Message Form */
          <motion.div 
            className="max-w-2xl mx-auto"
            ref={formRef}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div 
              className="text-center mb-10"
              variants={fadeIn}
            >
              <h2 className="text-3xl font-cormorant text-foreground mb-2">Leave Your Message</h2>
              <p className="text-muted-foreground">Share your thoughts and well-wishes with the couple</p>
            </motion.div>

            {isSubmitted ? (
              <motion.div 
                className="p-16 bg-secondary/20 text-center rounded-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="mx-auto p-4 rounded-full bg-primary/10 w-24 h-24 flex items-center justify-center">
                    <Heart className="w-12 h-12 text-primary" />
                  </div>
                </motion.div>
                <h3 className="text-3xl font-cormorant text-foreground mb-3">Thank You!</h3>
                <p className="text-foreground font-montserrat mb-6">
                  Your message has been added to the wall.
                </p>
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setActiveTab('messages');
                  }}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-sm font-montserrat text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
                >
                  View All Messages
                </button>
              </motion.div>
            ) : (
              <motion.div 
                className="bg-background p-8 rounded-lg shadow-md"
                variants={fadeIn}
              >
                <form 
                  className="space-y-6"
                  onSubmit={handleSubmit(onSubmit)}
                >
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-foreground font-montserrat text-sm mb-2">Your Name</label>
                    <input
                      type="text"
                      id="name"
                      className={`w-full p-3 border ${errors.name ? 'border-destructive' : 'border-input'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary`}
                      placeholder="Enter your name"
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="mt-1 text-destructive text-xs">{errors.name.message}</p>
                    )}
                  </div>
                  
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-foreground font-montserrat text-sm mb-2">Your Email</label>
                    <input
                      type="email"
                      id="email"
                      className={`w-full p-3 border ${errors.email ? 'border-destructive' : 'border-input'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary`}
                      placeholder="Enter your email"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="mt-1 text-destructive text-xs">{errors.email.message}</p>
                    )}
                  </div>
                  
                  {/* Message Field */}
                  <div>
                    <label htmlFor="content" className="block text-foreground font-montserrat text-sm mb-2">Your Message</label>
                    <Textarea
                      id="content"
                      className={`w-full p-3 h-40 border ${errors.content ? 'border-destructive' : 'border-input'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary`}
                      placeholder="Share your message for the couple..."
                      {...register("content")}
                    />
                    {errors.content && (
                      <p className="mt-1 text-destructive text-xs">{errors.content.message}</p>
                    )}
                    <div className="mt-1 text-muted-foreground text-xs text-right">
                      <span>Maximum 500 characters</span>
                    </div>
                  </div>
                  
                  {/* Submit Button */}
                  <div className="flex justify-center pt-4">
                    <motion.button 
                      type="submit"
                      className="custom-button px-8 py-3 bg-primary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-lg transition-all duration-300 rounded-sm disabled:opacity-70 flex items-center"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Message
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
            
            {!isSubmitted && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setActiveTab('messages')}
                  className="text-primary hover:text-primary/80 font-montserrat text-sm"
                >
                  ← Back to messages
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default Messages;