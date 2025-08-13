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
import { Button } from '@/components/ui/button';

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
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 10;
  
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
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages");
      return response.json();
    },
  });

  // Calculate pagination
  const totalPages = Math.ceil(data.messages.length / messagesPerPage);
  const startIndex = (currentPage - 1) * messagesPerPage;
  const endIndex = startIndex + messagesPerPage;
  const currentMessages = data.messages.slice(startIndex, endIndex);

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
    <section id="messages" className="py-16 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          ref={titleRef}
          className="text-center mb-12 space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.div 
            className="inline-flex items-center gap-2 text-accent mb-2"
            variants={fadeIn}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-montserrat uppercase tracking-wider">Share Your Wishes</span>
          </motion.div>
          
          <motion.h2 
            className="text-4xl md:text-5xl font-cormorant text-foreground"
            variants={fadeIn}
          >
            Message Wall
          </motion.h2>
          
          <motion.p 
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-montserrat"
            variants={fadeIn}
          >
            Leave a message for Emily & Alexander to read on their special day
          </motion.p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Messages Display */}
          <motion.div 
            ref={messagesRef}
            className="order-2 lg:order-1"
            variants={staggerContainer}
            initial="hidden"
            animate={isMessagesInView ? "visible" : "hidden"}
          >
            <motion.h3 
              className="text-2xl font-cormorant text-foreground mb-6"
              variants={fadeIn}
            >
              Recent Messages ({data.messages.length})
            </motion.h3>
            
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 rounded-lg h-32"></div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <motion.p variants={fadeIn} className="text-center text-muted-foreground">
                Failed to load messages. Please try again later.
              </motion.p>
            ) : currentMessages.length === 0 ? (
              <motion.p variants={fadeIn} className="text-center text-muted-foreground">
                Be the first to leave a message!
              </motion.p>
            ) : (
              <>
                <motion.div className="space-y-4" variants={staggerContainer}>
                  {currentMessages.map((message) => (
                    <motion.div 
                      key={message.id}
                      variants={scaleIn}
                    >
                      <Card className="hover:shadow-lg transition-shadow duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-accent text-white text-sm">
                                {getInitials(message.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-baseline justify-between mb-1">
                                <h4 className="font-montserrat font-semibold text-foreground">
                                  {message.name}
                                </h4>
                                <span className="text-xs text-muted-foreground">
                                  {formatMessageDate(message.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Message Form */}
          <motion.div 
            className="order-1 lg:order-2"
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
      </div>
    </section>
  );
};

export default MessageWallSection;