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
import { MessageCircle } from 'lucide-react';

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

const MessageWallSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isMessagesInView = useInView(messagesRef, { once: true, amount: 0.2 });
  const isFormInView = useInView(formRef, { once: true, amount: 0.3 });
  
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
    <section id="messages" className="py-20 bg-muted/30" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          ref={titleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-4xl font-cormorant text-foreground mb-4"
            variants={fadeIn}
          >
            Message Wall
          </motion.h2>
          <motion.div 
            className="w-20 h-0.5 bg-accent mx-auto mb-6"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Share your congratulations, memories, and well-wishes for the couple
          </motion.p>
        </motion.div>
        
        {/* Messages Display */}
        <motion.div 
          className="max-w-4xl mx-auto mb-16"
          ref={messagesRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isMessagesInView ? "visible" : "hidden"}
        >
          {isLoading && (
            <div className="text-center p-8">
              <div className="animate-pulse flex flex-col items-center justify-center">
                <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
                <div className="h-4 w-48 bg-primary/20 rounded mb-4"></div>
                <div className="h-20 w-full bg-muted rounded"></div>
              </div>
            </div>
          )}
          
          {isError && (
            <div className="text-center p-8 text-destructive">
              <p>Failed to load messages. Please try again later.</p>
            </div>
          )}
          
          {!isLoading && !isError && (data?.messages?.length === 0 || !data?.messages) && (
            <div className="text-center p-8 bg-white/50 rounded-lg shadow-sm">
              <MessageCircle className="h-12 w-12 text-accent/50 mx-auto mb-4" />
              <h3 className="text-lg font-cormorant text-foreground mb-2">No Messages Yet</h3>
              <p className="text-muted-foreground text-sm">
                Be the first to leave a message for the couple!
              </p>
            </div>
          )}
          
          {!isLoading && !isError && data?.messages && data.messages.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          )}
        </motion.div>
        
        {/* Message Form */}
        <motion.div 
          className="max-w-xl mx-auto mt-12 bg-background p-8 rounded-lg shadow-md"
          ref={formRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isFormInView ? "visible" : "hidden"}
        >
          <motion.h3 
            className="text-2xl font-cormorant text-foreground mb-6 text-center"
            variants={fadeIn}
          >
            Leave Your Message
          </motion.h3>

          {isSubmitted ? (
            <motion.div 
              className="p-8 bg-secondary bg-opacity-20 text-center rounded-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-4"
              >
                <MessageCircle className="mx-auto h-12 w-12 text-primary" />
              </motion.div>
              <h3 className="text-3xl font-cormorant text-foreground mb-3">Thank You!</h3>
              <p className="text-foreground font-montserrat">
                Your message has been added to the wall.
              </p>
            </motion.div>
          ) : (
            <motion.form 
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              variants={fadeIn}
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
                  className={`w-full p-3 h-32 border ${errors.content ? 'border-destructive' : 'border-input'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary`}
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
                  className="custom-button px-8 py-3 bg-primary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-lg transition-all duration-300 rounded-sm disabled:opacity-70"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                >
                  {isPending ? "Sending..." : "Submit Message"}
                </motion.button>
              </div>
            </motion.form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default MessageWallSection;